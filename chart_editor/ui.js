/* ============================================================
   ui.js - UI 工具（Toast / 同步 / 弹窗 / 大小预估）
   依赖：state.js
   ============================================================ */
"use strict";

function showToast(msg, type) {
  var t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast " + (type || "success") + " show";
  clearTimeout(t._timeout);
  t._timeout = setTimeout(function() { t.classList.remove("show"); }, 3000);
}

function syncGlobals() {
  var bpmEl = document.getElementById("gBPM");
  var srEl = document.getElementById("gSampleRate");
  var offEl = document.getElementById("gOffset");
  var durEl = document.getElementById("gDuration");
  var fovEl = document.getElementById("gFOV");
  var bpm = Math.round(evalNumericInput(bpmEl.value));
  var sr = evalNumericInput(srEl.value);
  var off = evalNumericInput(offEl.value);
  var dur = evalNumericInput(durEl.value);
  var fov = evalNumericInput(fovEl.value);
  state.bpm = (isFinite(bpm) && bpm > 0) ? bpm : state.bpm || 120;
  state.sampleRateReal = (isFinite(sr) && sr > 0) ? sr : state.sampleRateReal || 10;
  state.offsetSec = isFinite(off) ? off : (state.offsetSec || 0);
  state.duration = (isFinite(dur) && dur > 0) ? dur : state.duration || 30;
  state.fov = (isFinite(fov) && fov > 0) ? fov : state.fov || 55;
  // 倍速
  var spEl = document.getElementById("gSpeed");
  if (spEl) state.speed = parseInt(spEl.value) / 100;
  // 更新进度数字最小宽度
  var tdEl = document.getElementById("timeDisplay");
  if (tdEl) {
    var maxStr = state.duration.toFixed(2) + "s";
    tdEl._maxLen = maxStr.length;
    tdEl.style.minWidth = (maxStr.length * 0.6) + "em";
  }
  var nsEl = document.getElementById("gNoteScale");
  if (nsEl) state.noteScale = parseInt(nsEl.value) / 100;
}

var sizeEstTimeout = null;
function scheduleSizeEstimate() {
  if (sizeEstTimeout) return;
  sizeEstTimeout = setTimeout(function() {
    sizeEstTimeout = null;
    updateSizeEstimate();
  }, 800);
}

function updateSizeEstimate() {
  try {
    var hvp = encodeHVP(true);
    if (hvp) {
      var kb = (hvp.length / 1024).toFixed(1);
      document.getElementById("sizeEstimate").textContent = "预估: " + hvp.length + " 字符 (" + kb + " KB)";
    } else {
      document.getElementById("sizeEstimate").textContent = "预估: 校验失败";
    }
  } catch (e) {
    document.getElementById("sizeEstimate").textContent = "预估: 错误";
  }
}

function showImportModal() {
  document.getElementById("importModal").classList.add("active");
  document.getElementById("importText").value = "";
  document.getElementById("importFile").value = "";
}
function closeImportModal() {
  document.getElementById("importModal").classList.remove("active");
}
function showResult() {
  document.getElementById("resultScore").textContent = pad(Math.round(game.score), 7);
  document.getElementById("resultModal").classList.add("active");
}

function escapeHtmlAttr(s) {
  return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function showHelp() { document.getElementById("helpModal").classList.add("active"); }
function closeHelp() { document.getElementById("helpModal").classList.remove("active"); }

