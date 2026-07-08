/* ============================================================
   audio.js - 音频加载与播放
   依赖：state.js, sfx.js, ui.js
   ============================================================ */
"use strict";

var audioEnergy = null;  // 预计算 RMS 能量数组，供时间轴使用

function computeAudioEnergy(buffer, binsPerSec) {
  if (binsPerSec === undefined) binsPerSec = 50;
  var sr = buffer.sampleRate;
  var nc = buffer.numberOfChannels;
  var binSamples = Math.floor(sr / binsPerSec);
  var totalBins = Math.ceil(buffer.length / binSamples);
  var energy = new Float32Array(totalBins);
  var maxE = 0;
  for (var bi = 0; bi < totalBins; bi++) {
    var start = bi * binSamples;
    var end = Math.min(start + binSamples, buffer.length);
    var sum = 0, count = (end - start) * nc;
    for (var ci = 0; ci < nc; ci++) {
      var ch = buffer.getChannelData(ci);
      for (var si = start; si < end; si++) sum += ch[si] * ch[si];
    }
    var rms = Math.sqrt(sum / count);
    energy[bi] = rms;
    if (rms > maxE) maxE = rms;
  }
  // 归一化 0~1
  if (maxE > 0) { for (var ni = 0; ni < totalBins; ni++) energy[ni] /= maxE; }
  return { data: energy, binsPerSec: binsPerSec, duration: buffer.duration };
}

document.addEventListener("DOMContentLoaded", function() {
  var audioFile = document.getElementById("audioFile");
  if (audioFile) audioFile.addEventListener("change", handleAudioUpload);
});

function handleAudioUpload(e) {
  var file = e.target.files[0];
  if (!file) return;
  state.audioPath = file.name;
  if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  var reader = new FileReader();
  reader.onload = function(ev) {
    var arrayBuf = ev.target.result;
    tryReadBPMFromMP3(arrayBuf);
    state.audioCtx.decodeAudioData(arrayBuf.slice(0), function(buffer) {
      state.audioBuffer = buffer;
      var dur = buffer.duration;
      state.duration = dur;
      document.getElementById("gDuration").value = dur.toFixed(2);
      var fname = file.name;
      if (fname.length > 18) fname = fname.slice(0, 15) + "...";
      document.getElementById("audioInfo").textContent = fname + " (" + dur.toFixed(1) + "s)";
      document.getElementById("audioInfo").title = file.name + " (" + dur.toFixed(2) + "s)";
      showToast("音频已加载, 时长 " + dur.toFixed(2) + "s", "success");
      audioEnergy = computeAudioEnergy(buffer);
      scheduleSizeEstimate();
    }, function() { showToast("音频解码失败", "error"); });
  };
  reader.readAsArrayBuffer(file);
}

function tryReadBPMFromMP3(arrayBuf) {
  try {
    var bytes = new Uint8Array(arrayBuf);
    if (bytes.length < 10) return;
    if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return;
    var ver = bytes[3];
    var tagSize = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
    var p = 10, end = Math.min(10 + tagSize, bytes.length);
    while (p < end - 10) {
      var fid = String.fromCharCode(bytes[p], bytes[p+1], bytes[p+2], bytes[p+3]);
      if (fid === "\0\0\0\0" || !/^[A-Z0-9]{4}$/.test(fid)) break;
      var fsize = (ver === 4)
        ? (bytes[p+4]<<21)|(bytes[p+5]<<14)|(bytes[p+6]<<7)|bytes[p+7]
        : (bytes[p+4]<<24)|(bytes[p+5]<<16)|(bytes[p+6]<<8)|bytes[p+7];
      if (fid === "TBPM") {
        var frameStart = p + 10, encoding = bytes[frameStart];
        var textBytes = bytes.slice(frameStart + 1, frameStart + fsize);
        var text = (encoding === 0 || encoding === 3)
          ? new TextDecoder("utf-8").decode(textBytes)
          : new TextDecoder("utf-16").decode(textBytes);
        text = text.replace(/\0+/g,"").trim();
        var bpmVal = parseInt(parseFloat(text));
        if (bpmVal >= 1 && bpmVal <= 999) {
          state.bpm = bpmVal;
          document.getElementById("gBPM").value = bpmVal;
          showToast("从音频读到 BPM: " + bpmVal, "info");
          return;
        }
      }
      p += 10 + fsize;
    }
  } catch (e) {}
}

function startAudioAt(gameTime) {
  if (!state.audioBuffer || !state.audioCtx) return;
  try {
    stopAudio();
    state.audioSource = state.audioCtx.createBufferSource();
    state.audioSource.buffer = state.audioBuffer;
    state.audioSource.playbackRate.value = state.speed || 1.0;
    if (!state._musicGain) {
      state._musicGain = state.audioCtx.createGain();
      state._musicGain.gain.value = sfx.musicVolume;
      state._musicGain.connect(state.audioCtx.destination);
    }
    state.audioSource.connect(state._musicGain);
    var audioPos = gameTime + state.offsetSec;
    if (audioPos >= 0 && audioPos < state.audioBuffer.duration) {
      state.audioSource.start(0, audioPos);
      state.audioStartedAt = performance.now();
      state.audioStartOffset = audioPos;
    } else if (audioPos < 0) {
      state.audioSource.start(state.audioCtx.currentTime + (-audioPos), 0);
      state.audioStartedAt = performance.now() + (-audioPos) * 1000;
      state.audioStartOffset = 0;
    }
  } catch (e) { console.warn("startAudio error: " + e); }
}

function stopAudio() {
  if (state.audioSource) {
    try { state.audioSource.stop(); } catch (e) {}
    state.audioSource = null;
  }
}

function loadAudioFromPath(path) {
  if (!path || !state.audioCtx) return;
  showToast("尝试加载音频: " + path + "……", "info");
  fetch(path).then(function(resp) {
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    return resp.arrayBuffer();
  }).then(function(buf) {
    state.audioCtx.decodeAudioData(buf.slice(0), function(buffer) {
      state.audioBuffer = buffer;
      state.audioPath = path;
      var dur = buffer.duration;
      state.duration = dur;
      document.getElementById("gDuration").value = dur.toFixed(2);
      var fname = path.split("/").pop().split("\\").pop();
      if (fname.length > 18) fname = fname.slice(0, 15) + "...";
      document.getElementById("audioInfo").textContent = fname + " (" + dur.toFixed(1) + "s)";
      document.getElementById("audioInfo").title = path + " (" + dur.toFixed(2) + "s)";
      showToast("已自动加载音频: " + fname, "success");
      audioEnergy = computeAudioEnergy(buffer);
      scheduleSizeEstimate();
    }, function() { showToast("音频解码失败: " + path, "error"); });
  }).catch(function(err) {
    showToast("未能自动加载音频: " + path + "，请手动选择", "warn");
  });
}
