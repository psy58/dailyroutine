(function () {
  "use strict";

  var STORAGE_KEY = "haru-routine-state-v1";
  var SCREEN_NAMES = {
    start: "시작 화면",
    build: "일과 구성 화면",
    routine: "일과 진행 화면",
    finish: "마침 화면",
    settings: "교사용 설정 화면"
  };

  var defaultActivities = [
    { id: "arrival", name: "등교하기", icon: "🏫", hint: "학교에 도착하면 선생님께 인사해요.", steps: ["학교에 도착해요", "교실로 이동해요", "선생님께 인사해요"], included: true },
    { id: "greeting", name: "외투와 가방 정리하기", icon: "🧥", hint: "외투와 가방을 정해진 자리에 놓아요.", steps: ["외투를 벗어요", "외투를 걸어요", "가방을 제자리에 놓아요"], included: true },
    { id: "calendar", name: "아침 활동", icon: "☀️", hint: "오늘 날짜와 날씨를 살펴봐요.", steps: ["자리에 앉아요", "날짜와 날씨를 확인해요", "아침 활동을 해요"], included: true },
    { id: "ready", name: "1교시", icon: "1️⃣", hint: "첫 번째 수업을 차분하게 시작해요.", steps: ["수업 준비물을 꺼내요", "선생님의 안내를 들어요", "활동을 해요"], included: true },
    { id: "break", name: "쉬는 시간", icon: "🧩", hint: "물을 마시거나 좋아하는 놀이를 하며 쉬어요.", steps: ["자리에서 일어나요", "편안하게 쉬어요", "종이 울리면 자리로 와요"], included: true },
    { id: "math", name: "2교시", icon: "2️⃣", hint: "두 번째 수업도 하나씩 따라 해요.", steps: ["수업 준비물을 확인해요", "선생님의 안내를 들어요", "활동을 해요"], included: true },
    { id: "lunch", name: "점심시간", icon: "🍱", hint: "손을 씻고 천천히 맛있게 먹어요.", steps: ["손을 깨끗이 씻어요", "차례를 지켜요", "천천히 먹어요", "자리를 정리해요"], included: true },
    { id: "walk", name: "오후 수업", icon: "📚", hint: "점심을 먹은 뒤 오후 수업을 시작해요.", steps: ["자리에 앉아요", "준비물을 꺼내요", "오후 활동을 해요"], included: true },
    { id: "korean", name: "방과후 활동", icon: "🎨", hint: "좋아하는 방과후 활동에 참여해요.", steps: ["활동 장소로 이동해요", "선생님의 안내를 들어요", "즐겁게 참여해요"], included: false },
    { id: "cleanup", name: "하교 준비하기", icon: "🎒", hint: "집에 갈 준비물을 가방에 넣어요.", steps: ["알림장을 확인해요", "준비물을 가방에 넣어요", "내 자리를 정리해요"], included: true },
    { id: "home", name: "하교하기", icon: "👋", hint: "선생님과 인사하고 안전하게 집으로 가요.", steps: ["외투와 가방을 챙겨요", "선생님께 인사해요", "안전하게 이동해요"], included: true }
  ];

  function createDefaultState() {
    var cards = defaultActivities.map(function (card) {
      return { id: card.id, name: card.name, icon: card.icon, hint: card.hint, steps: card.steps.slice(), included: card.included };
    });
    var routineIds = cards.filter(function (card) { return card.included; }).map(function (card) { return card.id; });
    return {
      version: 1,
      cards: cards,
      routineIds: routineIds,
      messages: {
        start: "오늘 할 일을 눈으로 확인하고 하나씩 해봐요.",
        build: "하고 싶은 활동을 고른 뒤 순서를 확인해요.",
        routine: "지금 보이는 활동 하나에 집중해요.",
        finish: "모든 활동을 끝까지 잘 해냈어요."
      },
      preferences: { speechEnabled: false },
      progress: { routineIds: [], currentIndex: 0, completedIds: [] }
    };
  }

  function normalizeState(input) {
    var fallback = createDefaultState();
    if (!input || typeof input !== "object" || Array.isArray(input)) return fallback;

    var sourceCards = Array.isArray(input.cards) ? input.cards : fallback.cards;
    var seen = Object.create(null);
    var cards = sourceCards.map(function (card, index) {
      if (!card || typeof card !== "object") return null;
      var rawId = typeof card.id === "string" && card.id.trim() ? card.id.trim() : "card-" + index;
      var id = rawId;
      var suffix = 2;
      while (seen[id]) { id = rawId + "-" + suffix; suffix += 1; }
      seen[id] = true;
      var steps = Array.isArray(card.steps) ? card.steps.filter(function (step) { return typeof step === "string" && step.trim(); }).map(function (step) { return step.trim(); }) : [];
      return {
        id: id,
        name: typeof card.name === "string" && card.name.trim() ? card.name.trim() : "이름 없는 활동",
        icon: typeof card.icon === "string" && card.icon.trim() ? card.icon.trim().slice(0, 8) : "⭐",
        hint: typeof card.hint === "string" && card.hint.trim() ? card.hint.trim() : "천천히 하나씩 해봐요.",
        steps: steps,
        included: Boolean(card.included)
      };
    }).filter(Boolean);

    function validUniqueIds(value) {
      var used = Object.create(null);
      return (Array.isArray(value) ? value : []).filter(function (id) {
        if (typeof id !== "string" || !seen[id] || used[id]) return false;
        used[id] = true;
        return true;
      });
    }

    var routineIds = validUniqueIds(input.routineIds);
    if (!Array.isArray(input.routineIds)) routineIds = cards.filter(function (card) { return card.included; }).map(function (card) { return card.id; });
    var progressSource = input.progress && typeof input.progress === "object" ? input.progress : {};
    var progressIds = validUniqueIds(progressSource.routineIds);
    var completedIds = validUniqueIds(progressSource.completedIds).filter(function (id) { return progressIds.indexOf(id) !== -1; });
    var currentIndex = Number.isInteger(progressSource.currentIndex) ? progressSource.currentIndex : 0;
    currentIndex = progressIds.length ? Math.max(0, Math.min(currentIndex, progressIds.length - 1)) : 0;
    var inputMessages = input.messages && typeof input.messages === "object" ? input.messages : {};
    var messages = {};
    Object.keys(fallback.messages).forEach(function (key) {
      messages[key] = typeof inputMessages[key] === "string" && inputMessages[key].trim() ? inputMessages[key].trim().slice(0, 160) : fallback.messages[key];
    });

    return {
      version: 1,
      cards: cards,
      routineIds: routineIds,
      messages: messages,
      preferences: { speechEnabled: Boolean(input.preferences && input.preferences.speechEnabled) },
      progress: { routineIds: progressIds, currentIndex: currentIndex, completedIds: completedIds }
    };
  }

  function buildRoutineFromSelection(state, selectedIds) {
    var next = normalizeState(state);
    var allowed = Object.create(null);
    next.cards.forEach(function (card) { allowed[card.id] = true; });
    var used = Object.create(null);
    var ids = (Array.isArray(selectedIds) ? selectedIds : []).filter(function (id) {
      if (!allowed[id] || used[id]) return false;
      used[id] = true;
      return true;
    });
    next.routineIds = ids.slice();
    next.progress = { routineIds: ids.slice(), currentIndex: 0, completedIds: [] };
    return next;
  }

  function completeCurrent(progress) {
    var source = progress && typeof progress === "object" ? progress : {};
    var routineIds = Array.isArray(source.routineIds) ? source.routineIds.slice() : [];
    var completedIds = Array.isArray(source.completedIds) ? source.completedIds.slice() : [];
    var index = Number.isInteger(source.currentIndex) ? Math.max(0, Math.min(source.currentIndex, Math.max(0, routineIds.length - 1))) : 0;
    var id = routineIds[index];
    if (id && completedIds.indexOf(id) === -1) completedIds.push(id);
    return { routineIds: routineIds, currentIndex: index, completedIds: completedIds };
  }

  function moveItem(items, fromIndex, direction) {
    var copy = Array.isArray(items) ? items.slice() : [];
    var toIndex = fromIndex + direction;
    if (!Number.isInteger(fromIndex) || (direction !== -1 && direction !== 1) || fromIndex < 0 || fromIndex >= copy.length || toIndex < 0 || toIndex >= copy.length) return copy;
    var item = copy[fromIndex];
    copy[fromIndex] = copy[toIndex];
    copy[toIndex] = item;
    return copy;
  }

  window.HaruApp = {
    createDefaultState: createDefaultState,
    normalizeState: normalizeState,
    buildRoutineFromSelection: buildRoutineFromSelection,
    completeCurrent: completeCurrent,
    moveItem: moveItem
  };

  if (typeof document === "undefined") return;

  var state;
  var settingsDraft;
  var selectedIds = [];
  var storageAvailable = true;
  var toastTimer;
  var currentScreen = "start";

  function byId(id) { return document.getElementById(id); }
  function copyState(value) { return JSON.parse(JSON.stringify(value)); }
  function findCard(id, source) { return (source || state).cards.find(function (card) { return card.id === id; }); }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      try {
        return normalizeState(JSON.parse(raw));
      } catch (parseError) {
        setTimeout(function () { showToast("저장한 내용을 읽지 못했어요. 기본 일과로 계속할게요."); }, 0);
        return createDefaultState();
      }
    } catch (storageError) {
      storageAvailable = false;
      setTimeout(function () { showToast("이 기기에 저장할 수 없어요. 지금은 앱을 계속 사용할 수 있어요."); }, 0);
      return createDefaultState();
    }
  }

  function saveState(options) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageAvailable = true;
      if (options && options.announce) showToast("이 기기에 저장했어요.");
      return true;
    } catch (error) {
      storageAvailable = false;
      showToast("저장하지 못했어요. 이 화면에서는 계속 사용할 수 있어요.");
      return false;
    }
  }

  function showToast(message) {
    var toast = byId("toast");
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = window.setTimeout(function () { toast.classList.remove("show"); }, 3600);
  }

  function setScreen(name, focusHeading) {
    currentScreen = name;
    document.querySelectorAll(".screen").forEach(function (screen) { screen.hidden = screen.id !== name + "-screen"; });
    byId("screen-location").textContent = SCREEN_NAMES[name];
    document.title = SCREEN_NAMES[name] + " | 하루 한 걸음";
    if (focusHeading !== false) {
      var heading = document.querySelector("#" + name + "-screen h1");
      if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus(); }
    }
    window.scrollTo(0, 0);
  }

  function renderStart() {
    byId("start-message").textContent = state.messages.start;
    var hasProgress = state.progress.routineIds.length > 0;
    byId("resume-button").hidden = !hasProgress;
    byId("resume-note").hidden = !hasProgress;
  }

  function openBuild() {
    selectedIds = state.routineIds.filter(function (id) { return Boolean(findCard(id)); });
    renderBuild();
    setScreen("build");
  }

  function renderBuild() {
    byId("build-message").textContent = state.messages.build;
    byId("build-empty").hidden = state.cards.length !== 0;
    byId("build-content").hidden = state.cards.length === 0;
    var grid = byId("build-card-grid");
    grid.replaceChildren();
    state.cards.forEach(function (card) {
      var selected = selectedIds.indexOf(card.id) !== -1;
      var button = document.createElement("button");
      button.type = "button";
      button.className = "pick-card";
      button.dataset.cardId = card.id;
      button.dataset.action = "toggle-card";
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-label", card.name + (selected ? " 선택됨, 누르면 선택 해제" : " 선택 안 됨, 누르면 선택"));
      button.innerHTML = '<span class="icon" aria-hidden="true"></span><span class="name"></span><span class="state-label"></span>';
      button.querySelector(".icon").textContent = card.icon;
      button.querySelector(".name").textContent = card.name;
      button.querySelector(".state-label").textContent = selected ? "✓ 선택됨" : "+ 선택하기";
      grid.appendChild(button);
    });
    renderSelectedList();
  }

  function renderSelectedList() {
    var list = byId("selected-list");
    list.replaceChildren();
    selectedIds.forEach(function (id, index) {
      var card = findCard(id);
      if (!card) return;
      var item = document.createElement("li");
      var name = document.createElement("span");
      name.className = "selected-name";
      name.textContent = (index + 1) + ". " + card.icon + " " + card.name;
      item.appendChild(name);
      item.appendChild(makeSmallButton("↑", "move-selected-up", id, card.name + " 위로 이동", index === 0));
      item.appendChild(makeSmallButton("↓", "move-selected-down", id, card.name + " 아래로 이동", index === selectedIds.length - 1));
      list.appendChild(item);
    });
    byId("selection-empty").hidden = selectedIds.length > 0;
    byId("begin-routine").disabled = selectedIds.length === 0;
  }

  function makeSmallButton(text, action, id, label, disabled) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "small-button";
    button.textContent = text;
    button.dataset.action = action;
    button.dataset.cardId = id;
    button.setAttribute("aria-label", label);
    button.disabled = Boolean(disabled);
    return button;
  }

  function beginRoutine() {
    if (!selectedIds.length) { showToast("먼저 활동 카드를 하나 이상 골라 주세요."); return; }
    state = buildRoutineFromSelection(state, selectedIds);
    saveState();
    renderRoutine();
    setScreen("routine");
  }

  function currentCard() {
    return findCard(state.progress.routineIds[state.progress.currentIndex]);
  }

  function renderRoutine() {
    byId("routine-message").textContent = state.messages.routine;
    var ids = state.progress.routineIds;
    var card = currentCard();
    var empty = !ids.length || !card;
    byId("routine-empty").hidden = !empty;
    byId("routine-content").hidden = empty;
    if (empty) return;

    var completed = state.progress.completedIds.indexOf(card.id) !== -1;
    byId("activity-position").textContent = (state.progress.currentIndex + 1) + " / " + ids.length + "번째 활동";
    byId("current-icon").textContent = card.icon;
    byId("current-activity-name").textContent = card.name;
    var stepBox = byId("step-box");
    stepBox.replaceChildren();
    if (card.steps.length) {
      var stepTitle = document.createElement("h3");
      stepTitle.textContent = "이렇게 해요";
      var steps = document.createElement("ol");
      card.steps.forEach(function (step) { var li = document.createElement("li"); li.textContent = step; steps.appendChild(li); });
      stepBox.append(stepTitle, steps);
      stepBox.hidden = false;
    } else {
      stepBox.hidden = true;
    }
    byId("feedback").textContent = completed ? "참 잘했어요! 완료했어요. 다음 활동을 확인해 볼까요? ⭐" : "";
    byId("complete-button").hidden = completed;
    byId("next-button").hidden = !completed;
    byId("next-button").innerHTML = state.progress.currentIndex === ids.length - 1 ? '<span aria-hidden="true">🎉</span> 마침 화면 보기' : '<span aria-hidden="true">➡️</span> 다음 활동 보기';
    byId("previous-button").disabled = state.progress.currentIndex === 0;
    var speechSupported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    var speechEnabled = state.preferences.speechEnabled;
    var toggleButton = byId("speech-toggle-button");
    toggleButton.disabled = !speechSupported;
    toggleButton.setAttribute("aria-pressed", String(speechEnabled));
    toggleButton.innerHTML = speechEnabled ? '<span aria-hidden="true">🔊</span> 음성 끄기' : '<span aria-hidden="true">🔇</span> 음성 켜기';
    byId("speak-button").disabled = !speechSupported || !speechEnabled;
    byId("speech-note").textContent = !speechSupported
      ? "이 기기에서는 음성 안내를 지원하지 않아요. 화면의 글을 확인해 주세요."
      : speechEnabled
        ? "음성 안내가 켜져 있어요. 읽기 버튼을 누를 때만 음성이 나와요."
        : "음성 안내가 꺼져 있어요. 음성 켜기 버튼을 먼저 눌러 주세요.";
    renderStatusList();
  }

  function renderStatusList() {
    var list = byId("status-list");
    list.replaceChildren();
    state.progress.routineIds.forEach(function (id, index) {
      var card = findCard(id);
      if (!card) return;
      var isComplete = state.progress.completedIds.indexOf(id) !== -1;
      var isCurrent = index === state.progress.currentIndex;
      var status = isCurrent ? (isComplete ? "현재 · 완료" : "현재") : isComplete ? "완료" : index < state.progress.currentIndex ? "이전" : "다음";
      var symbol = isComplete ? "✅" : isCurrent ? "👉" : index < state.progress.currentIndex ? "◀️" : "⏭️";
      var item = document.createElement("li");
      item.className = (isComplete ? "completed " : "") + (isCurrent ? "current" : "");
      if (isCurrent) item.setAttribute("aria-current", "step");
      var symbolSpan = document.createElement("span");
      symbolSpan.className = "status-symbol";
      symbolSpan.setAttribute("aria-hidden", "true");
      symbolSpan.textContent = symbol;
      var label = document.createElement("span");
      label.textContent = card.icon + " " + card.name;
      var statusSpan = document.createElement("span");
      statusSpan.className = "status-text";
      statusSpan.textContent = status;
      item.append(symbolSpan, label, statusSpan);
      list.appendChild(item);
    });
  }

  function completeActivity() {
    state.progress = completeCurrent(state.progress);
    saveState();
    renderRoutine();
    byId("feedback").focus && byId("feedback").focus();
  }

  function nextActivity() {
    if (state.progress.currentIndex >= state.progress.routineIds.length - 1) {
      renderFinish();
      setScreen("finish");
      return;
    }
    state.progress.currentIndex += 1;
    saveState();
    renderRoutine();
    byId("current-activity-name").setAttribute("tabindex", "-1");
    byId("current-activity-name").focus();
  }

  function previousActivity() {
    if (state.progress.currentIndex === 0) return;
    state.progress.currentIndex -= 1;
    saveState();
    renderRoutine();
  }

  function retryActivity() {
    var card = currentCard();
    if (!card) return;
    state.progress.completedIds = state.progress.completedIds.filter(function (id) { return id !== card.id; });
    saveState();
    renderRoutine();
    byId("feedback").textContent = "좋아요. 처음부터 다시 해봐요. 🔄";
  }

  function showHint() {
    var card = currentCard();
    if (card) byId("feedback").textContent = "힌트: " + card.hint;
  }

  function speakCurrent() {
    var card = currentCard();
    if (!card || !state.preferences.speechEnabled || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
    window.speechSynthesis.cancel();
    var text = card.name + ". " + (card.steps.length ? card.steps.join(". ") : card.hint);
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.85;
    utterance.onerror = function () { showToast("음성을 들려주지 못했어요. 화면의 글을 확인해 주세요."); };
    window.speechSynthesis.speak(utterance);
  }

  function toggleSpeech() {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
    state.preferences.speechEnabled = !state.preferences.speechEnabled;
    if (!state.preferences.speechEnabled) window.speechSynthesis.cancel();
    saveState();
    renderRoutine();
    showToast(state.preferences.speechEnabled ? "음성 안내를 켰어요." : "음성 안내를 껐어요.");
    byId("speech-toggle-button").focus();
  }

  function renderFinish() { byId("finish-message").textContent = state.messages.finish; }

  function openSettings() {
    settingsDraft = copyState(state);
    renderSettings();
    setScreen("settings");
  }

  function renderSettings() {
    var list = byId("settings-card-list");
    list.replaceChildren();
    settingsDraft.cards.forEach(function (card, index) {
      var row = document.createElement("article");
      row.className = "settings-card";
      var info = document.createElement("div");
      info.className = "settings-card-info";
      var title = document.createElement("p");
      title.className = "settings-card-title";
      title.textContent = card.icon + " " + card.name;
      var meta = document.createElement("p");
      meta.className = "settings-card-meta";
      meta.textContent = "단계 " + card.steps.length + "개 · " + (card.included ? "기본 일과에 포함" : "기본 일과에서 제외");
      info.append(title, meta);
      var controls = document.createElement("div");
      controls.className = "settings-card-controls";
      controls.appendChild(makeSmallButton("↑", "move-card-up", card.id, card.name + " 표시 순서 위로 이동", index === 0));
      controls.appendChild(makeSmallButton("↓", "move-card-down", card.id, card.name + " 표시 순서 아래로 이동", index === settingsDraft.cards.length - 1));
      var includeLabel = document.createElement("label");
      includeLabel.className = "include-label";
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = card.included;
      checkbox.dataset.action = "toggle-included";
      checkbox.dataset.cardId = card.id;
      checkbox.setAttribute("aria-label", card.name + " 기본 일과에 포함");
      var includeText = document.createElement("span");
      includeText.textContent = "일과 포함";
      includeLabel.append(checkbox, includeText);
      controls.appendChild(includeLabel);
      var edit = makeSmallButton("✏️", "edit-card", card.id, card.name + " 수정", false);
      var remove = makeSmallButton("🗑️", "delete-card", card.id, card.name + " 삭제", false);
      controls.append(edit, remove);
      row.append(info, controls);
      list.appendChild(row);
    });
    byId("settings-empty").hidden = settingsDraft.cards.length !== 0;
    ["start", "build", "routine", "finish"].forEach(function (key) { byId("message-" + key).value = settingsDraft.messages[key]; });
  }

  function collectMessages() {
    ["start", "build", "routine", "finish"].forEach(function (key) {
      var value = byId("message-" + key).value.trim();
      settingsDraft.messages[key] = value || createDefaultState().messages[key];
    });
  }

  function saveSettings() {
    collectMessages();
    settingsDraft.routineIds = settingsDraft.cards.filter(function (card) { return card.included; }).map(function (card) { return card.id; });
    state = normalizeState(settingsDraft);
    saveState({ announce: true });
    renderStart();
    setScreen("start");
  }

  function restoreDefaults() {
    settingsDraft = createDefaultState();
    renderSettings();
    showToast("기본 예시를 불러왔어요. 저장 버튼을 눌러 적용해 주세요.");
  }

  function uniqueId() {
    var used = Object.create(null);
    settingsDraft.cards.forEach(function (card) { used[card.id] = true; });
    var id;
    do {
      id = "card-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    } while (used[id]);
    return id;
  }

  function openCardDialog(id) {
    var card = id ? findCard(id, settingsDraft) : null;
    byId("card-dialog-title").textContent = card ? "활동 카드 수정" : "활동 카드 추가";
    byId("card-id").value = card ? card.id : "";
    byId("card-name").value = card ? card.name : "";
    byId("card-icon").value = card ? card.icon : "⭐";
    byId("card-hint").value = card ? card.hint : "천천히 하나씩 해봐요.";
    byId("card-steps").value = card ? card.steps.join("\n") : "준비물을 확인해요\n활동을 해요";
    byId("card-step-count").value = card ? card.steps.length : 2;
    byId("card-included").checked = card ? card.included : true;
    byId("card-dialog").showModal();
    byId("card-name").focus();
  }

  function syncStepCount() {
    var count = Math.max(0, Math.min(12, Number(byId("card-step-count").value) || 0));
    var lines = byId("card-steps").value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    while (lines.length < count) lines.push("새 단계");
    lines = lines.slice(0, count);
    byId("card-steps").value = lines.join("\n");
    byId("card-step-count").value = count;
  }

  function syncCountFromSteps() {
    var count = byId("card-steps").value.split(/\r?\n/).filter(function (line) { return line.trim(); }).length;
    byId("card-step-count").value = Math.min(12, count);
  }

  function saveCard(event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    var id = byId("card-id").value;
    var card = {
      id: id || uniqueId(),
      name: byId("card-name").value.trim(),
      icon: byId("card-icon").value.trim(),
      hint: byId("card-hint").value.trim(),
      steps: byId("card-steps").value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean).slice(0, 12),
      included: byId("card-included").checked
    };
    var index = settingsDraft.cards.findIndex(function (item) { return item.id === id; });
    if (index === -1) settingsDraft.cards.push(card); else settingsDraft.cards[index] = card;
    byId("card-dialog").close();
    renderSettings();
  }

  function deleteCard(id) {
    var card = findCard(id, settingsDraft);
    if (!card) return;
    if (!window.confirm("‘" + card.name + "’ 카드를 삭제할까요?")) return;
    settingsDraft.cards = settingsDraft.cards.filter(function (item) { return item.id !== id; });
    settingsDraft.routineIds = settingsDraft.routineIds.filter(function (itemId) { return itemId !== id; });
    settingsDraft.progress.routineIds = settingsDraft.progress.routineIds.filter(function (itemId) { return itemId !== id; });
    settingsDraft.progress.completedIds = settingsDraft.progress.completedIds.filter(function (itemId) { return itemId !== id; });
    if (settingsDraft.progress.currentIndex >= settingsDraft.progress.routineIds.length) settingsDraft.progress.currentIndex = Math.max(0, settingsDraft.progress.routineIds.length - 1);
    renderSettings();
  }

  function resetData() {
    try { localStorage.removeItem(STORAGE_KEY); storageAvailable = true; } catch (error) { storageAvailable = false; }
    state = createDefaultState();
    settingsDraft = copyState(state);
    selectedIds = state.routineIds.slice();
    byId("confirm-dialog").close();
    renderStart();
    setScreen("start");
    showToast(storageAvailable ? "저장 데이터를 지우고 기본 예시로 돌아왔어요." : "저장 공간을 지우지 못했지만 기본 예시로 계속할게요.");
  }

  function handleAction(event) {
    var target = event.target.closest("[data-action]");
    if (!target) return;
    var action = target.dataset.action;
    var id = target.dataset.cardId;
    if (action === "go-home") { event.preventDefault(); renderStart(); setScreen("start"); }
    else if (action === "open-build") openBuild();
    else if (action === "open-settings") openSettings();
    else if (action === "resume") { renderRoutine(); setScreen("routine"); }
    else if (action === "toggle-card") {
      var index = selectedIds.indexOf(id);
      if (index === -1) selectedIds.push(id); else selectedIds.splice(index, 1);
      renderBuild();
      var updated = Array.prototype.find.call(document.querySelectorAll('[data-action="toggle-card"]'), function (button) { return button.dataset.cardId === id; });
      if (updated) updated.focus();
    }
    else if (action === "move-selected-up" || action === "move-selected-down") {
      selectedIds = moveItem(selectedIds, selectedIds.indexOf(id), action === "move-selected-up" ? -1 : 1);
      renderBuild();
    }
    else if (action === "begin-routine") beginRoutine();
    else if (action === "complete") completeActivity();
    else if (action === "next") nextActivity();
    else if (action === "previous") previousActivity();
    else if (action === "hint") showHint();
    else if (action === "retry") retryActivity();
    else if (action === "toggle-speech") toggleSpeech();
    else if (action === "speak") speakCurrent();
    else if (action === "new-routine") openBuild();
    else if (action === "save-settings") saveSettings();
    else if (action === "cancel-settings") { renderStart(); setScreen("start"); }
    else if (action === "restore-defaults") restoreDefaults();
    else if (action === "add-card") openCardDialog();
    else if (action === "edit-card") openCardDialog(id);
    else if (action === "delete-card") deleteCard(id);
    else if (action === "move-card-up" || action === "move-card-down") {
      var cardIndex = settingsDraft.cards.findIndex(function (card) { return card.id === id; });
      settingsDraft.cards = moveItem(settingsDraft.cards, cardIndex, action === "move-card-up" ? -1 : 1);
      renderSettings();
    }
    else if (action === "close-card-dialog") byId("card-dialog").close();
    else if (action === "confirm-reset") byId("confirm-dialog").showModal();
    else if (action === "close-confirm") byId("confirm-dialog").close();
    else if (action === "reset-data") resetData();
  }

  function handleChange(event) {
    if (event.target.dataset.action === "toggle-included") {
      var card = findCard(event.target.dataset.cardId, settingsDraft);
      if (card) { card.included = event.target.checked; renderSettings(); }
    }
  }

  function handleInput(event) {
    if (!settingsDraft || event.target.id.indexOf("message-") !== 0) return;
    var key = event.target.id.slice("message-".length);
    if (Object.prototype.hasOwnProperty.call(settingsDraft.messages, key)) settingsDraft.messages[key] = event.target.value;
  }

  function initialize() {
    state = loadState();
    document.addEventListener("click", handleAction);
    document.addEventListener("change", handleChange);
    document.addEventListener("input", handleInput);
    byId("card-form").addEventListener("submit", saveCard);
    byId("card-step-count").addEventListener("change", syncStepCount);
    byId("card-steps").addEventListener("input", syncCountFromSteps);
    ["card-dialog", "confirm-dialog"].forEach(function (id) {
      byId(id).addEventListener("click", function (event) { if (event.target === event.currentTarget) event.currentTarget.close(); });
    });
    renderStart();
    setScreen("start", false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
}());
