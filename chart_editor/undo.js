/* ============================================================
   undo.js - 撤销/重做系统 + 快捷键
   依赖：state.js, ui.js, tracks.js
   ============================================================ */
"use strict";

var undoStack = [];
var redoStack = [];
var undoMax = 50;

function saveStateSnap() {
  return {
    bpm: state.bpm,
    sampleRateReal: state.sampleRateReal,
    offsetSec: state.offsetSec,
    duration: state.duration,
    fov: state.fov,
    noteScale: state.noteScale,
    speed: state.speed,
    audioPath: state.audioPath,
    tracks: JSON.parse(JSON.stringify(state.tracks.map(function(t) {
      return { id: t.id, keyframes: t.keyframes, segmentPresets: t.segmentPresets };
    }))),
    notes: JSON.parse(JSON.stringify(state.notes)),
    openedTracks: state.openedTracks.slice()
  };
}

function applySnap(snap) {
  state.bpm = snap.bpm;
  state.sampleRateReal = snap.sampleRateReal;
  state.offsetSec = snap.offsetSec;
  state.duration = snap.duration;
  state.fov = snap.fov;
  state.noteScale = snap.noteScale;
  state.speed = snap.speed !== undefined ? snap.speed : 1.0;
  state.audioPath = snap.audioPath || "";
  state.tracks = snap.tracks;
  state.notes = snap.notes;
  state.openedTracks = snap.openedTracks;
  if (typeof applyStateToUI === "function") applyStateToUI();
}

function pushUndo() {
  undoStack.push(saveStateSnap());
  if (undoStack.length > undoMax) undoStack.shift();
  redoStack = [];  // 新操作清空重做栈
}

function undo() {
  if (undoStack.length === 0) { showToast("没有可撤销的操作", "info"); return; }
  redoStack.push(saveStateSnap());
  if (redoStack.length > undoMax) redoStack.shift();
  var snap = undoStack.pop();
  applySnap(snap);
  showToast("已撤销", "info");
}

function redo() {
  if (redoStack.length === 0) { showToast("没有可重做的操作", "info"); return; }
  undoStack.push(saveStateSnap());
  if (undoStack.length > undoMax) undoStack.shift();
  var snap = redoStack.pop();
  applySnap(snap);
  showToast("已重做", "info");
}

// 快捷键
document.addEventListener("keydown", function(e) {
  // ? 键打开/关闭帮助面板（不在输入框中时）
  if (e.key === "?" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA" && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (typeof showHelp === "function" && typeof closeHelp === "function") {
      var hm = document.getElementById("helpModal");
      if (hm && hm.classList.contains("active")) closeHelp(); else showHelp();
    }
    return;
  }
  if (e.ctrlKey || e.metaKey) {
    if (e.key === "z" || e.key === "Z") {
      e.preventDefault();
      if (e.shiftKey) { if (typeof redo === "function") redo(); }
      else { if (typeof undo === "function") undo(); }
    } else if (e.key === "y" || e.key === "Y") {
      e.preventDefault();
      if (typeof redo === "function") redo();
    } else if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      if (typeof exportHVF === "function") exportHVF();
    } else if (e.key === "o" || e.key === "O") {
      e.preventDefault();
      if (typeof showImportModal === "function") showImportModal();
    }
  }
});
