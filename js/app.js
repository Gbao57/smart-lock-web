// Cấu hình Firebase Realtime Database
const firebaseConfig = {
  apiKey: "AIzaSyDemoApiKeyForSmartLockProject123",
  databaseURL: "https://smart-lock-demo-d9fd4-default-rtdb.firebaseio.com"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// --- QUẢN LÝ DỮ LIỆU NGƯỜI DÙNG ---
const systemUsers = [
  { id: "u1", name: "Nguyễn Văn A (Chủ nhà)", pin: "1234" },
  { id: "u2", name: "Trần Thị B (Thành viên)", pin: "5678" },
  { id: "u3", name: "Lê Văn C (Khách)", pin: "0000" }
];

let currentUserId = "u1";

let isLocked = true;
let isESPOnline = true; // Trạng thái kết nối ESP32
let isBuzzerActive = false;
let webcamStream = null;

let autoLockCountdown = 10;
let countdownInterval = null;

// Biến cho PIN App
let currentInputPin = "";
let failedAttempts = 0;
let isLockedOut = false;

// Biến cho Bàn phím Phần cứng bên ngoài
let hwInputPin = "";
let hwFailedAttempts = 0;

window.addEventListener('load', () => {
  autoDetectDeviceView(); // Tự động phát hiện thiết bị Laptop/Mobile
  initUserSelector();
  addLogToUI('Hệ thống khởi động', 'Hệ thống', getCurrentTime());
  updateUIState();

  try {
    // Lắng nghe trạng thái Khóa cửa từ Firebase
    database.ref('device/isLocked').on('value', (snapshot) => {
      const val = snapshot.val();
      if (val !== null && val !== isLocked) {
        isLocked = val;
        updateUIState();
        if (!isLocked) {
          startAutoLockTimer();
        } else {
          clearAutoLockTimer();
        }
      }
    });

    // Lắng nghe trạng thái Online ESP32 từ Firebase
    database.ref('device/online').on('value', (snapshot) => {
      const val = snapshot.val();
      if (val !== null) {
        isESPOnline = val;
        setESPStatusUI(isESPOnline);
      }
    });

    // Lắng nghe Còi báo động Realtime
    database.ref('device/alarm/active').on('value', (snapshot) => {
      const active = snapshot.val() || false;
      isBuzzerActive = active;
      updateBuzzerUI(active);
      if (active) {
        showSecurityAlertModal("🚨 CẢNH BÁO: Phát hiện nhập sai mã PIN quá 3 lần bên ngoài cửa!");
      }
    });

  } catch (err) {
    console.warn("Chạy chế độ Offline Simulation:", err);
  }
});

// TỰ ĐỘNG PHÁT HIỆN THIẾT BỊ (DESKTOP / LAPTOP / MOBILE)
function autoDetectDeviceView() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const screenWidth = window.innerWidth;

  const isMobileDevice = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase()) || screenWidth < 768;

  if (isMobileDevice) {
    document.body.classList.add('mobile-view-active');
  } else {
    document.body.classList.remove('mobile-view-active');
  }
}

window.addEventListener('resize', () => {
  autoDetectDeviceView();
});

// Nạp danh sách người dùng vào thẻ <select>
function initUserSelector() {
  const selectEl = document.getElementById('currentUserSelect');
  if (!selectEl) return;
  selectEl.innerHTML = "";
  systemUsers.forEach(user => {
    const opt = document.createElement('option');
    opt.value = user.id;
    opt.innerText = user.name;
    selectEl.appendChild(opt);
  });
}

function onUserChange() {
  const selectEl = document.getElementById('currentUserSelect');
  currentUserId = selectEl.value;
}

function getCurrentUser() {
  return systemUsers.find(u => u.id === currentUserId) || systemUsers[0];
}

// Kiểm tra kết nối ESP32 trước khi thực hiện thao tác qua App
function checkOnlineBeforeAction(actionName) {
  if (!isESPOnline) {
    alert(`⚠️ ESP32 đang ở trạng thái Ngoại tuyến (Mất kết nối Internet).\nKhông thể thực hiện tính năng "${actionName}" từ xa!`);
    addLogToUI(`⚠️ Chặn thao tác ${actionName}: ESP32 Ngoại tuyến`, "Hệ thống", getCurrentTime());
    return false;
  }
  return true;
}

// 1. THAO TÁC BÀN PHÍM CỨNG VẬT LÝ BÊN NGOÀI CỬA (Offline-First: Mất Wi-Fi vẫn mở được)
function pressHwNum(num) {
  if (hwInputPin.length < 4) {
    hwInputPin += num;
    updateHwPinDisplay();
  }
}

function clearHwPin() {
  hwInputPin = "";
  updateHwPinDisplay();
  document.getElementById('hwPinMsg').innerText = "Mời nhập mã PIN 4 số";
}

function updateHwPinDisplay() {
  const disp = document.getElementById('hwPinDisplay');
  disp.innerText = hwInputPin.padEnd(4, '-');
}

function submitHwPin() {
  if (hwInputPin.length < 4) {
    document.getElementById('hwPinMsg').innerText = "⚠️ Chưa đủ 4 số!";
    return;
  }

  // Khóa tự xác thực PIN lưu trong bộ nhớ cục bộ
  const matchedUser = systemUsers.find(u => u.pin === hwInputPin);

  if (matchedUser) {
    hwFailedAttempts = 0;
    document.getElementById('hwPinMsg').innerText = `✅ Mã PIN hợp lệ!`;
    
    // Ghi nhật ký chung "Đã được mở khóa từ bên ngoài"
    setLockState(
      false, 
      "Đã được mở khóa từ bên ngoài", 
      isESPOnline ? "Bàn phím vật lý" : "Bàn phím vật lý (Offline)"
    );
    
    setTimeout(clearHwPin, 1500);
  } else {
    hwFailedAttempts++;
    document.getElementById('hwPinMsg').innerText = `❌ Sai PIN! Lần (${hwFailedAttempts}/3)`;
    addLogToUI(`⚠️ Nhập sai PIN tại bàn phím ngoài lần ${hwFailedAttempts}`, "Cảnh báo Vật lý", getCurrentTime());
    hwInputPin = "";
    updateHwPinDisplay();

    if (hwFailedAttempts >= 3) {
      triggerHardwareAlarm();
    }
  }
}

function triggerHardwareAlarm() {
  isBuzzerActive = true;
  document.getElementById('hwPinMsg').innerText = "🚨 CẢNH BÁO! CÒI HÚ KÍCH HOẠT!";
  addLogToUI("🚨 ĐỘT NHẬP VẬT LÝ: Nhập sai PIN 3 lần bên ngoài!", "An ninh Cực nguy hiểm", getCurrentTime());

  try {
    database.ref('device/alarm/active').set(true);
  } catch (e) {}

  updateBuzzerUI(true);
  showSecurityAlertModal("🚨 CẢNH BÁO ĐỘT NHẬP: Phát hiện ai đó cố tình dò mã PIN 3 lần tại Khóa vật lý bên ngoài!");
}

function dismissSecurityAlert() {
  document.getElementById('securityAlertModal').style.display = 'none';
  hwFailedAttempts = 0;
  isBuzzerActive = false;
  
  try {
    database.ref('device/alarm/active').set(false);
  } catch (e) {}

  updateBuzzerUI(false);
  clearHwPin();
}

function showSecurityAlertModal(msg) {
  document.getElementById('alertModalMsg').innerText = msg;
  document.getElementById('securityAlertModal').style.display = 'flex';
}

function updateBuzzerUI(active) {
  const badge = document.getElementById('buzzerStatusBadge');
  const led = document.getElementById('buzzerLed');
  if (active) {
    badge.className = 'buzzer-badge alarm';
    badge.innerHTML = '<i class="fa-solid fa-bell"></i> Còi: BÁO ĐỘNG!';
    led.className = 'ind-led on';
    led.innerText = 'ALARM ON';
  } else {
    badge.className = 'buzzer-badge quiet';
    badge.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> Còi: Tắt';
    led.className = 'ind-led off';
    led.innerText = 'OFF';
  }
}

// 2. TÙY CHỌN MỞ BẰNG KHUÔN MẶT QUA APP (Cần Internet)
async function startRealFaceScan() {
  if (!checkOnlineBeforeAction("Mở cửa bằng Khuôn mặt")) return;

  if (!isLocked) {
    alert("Cửa hiện tại đã mở sẵn!");
    return;
  }

  const cameraPanel = document.getElementById('cameraPanelCard');
  cameraPanel.style.display = 'block';

  const videoElement = document.getElementById('webcamStream');
  const statusText = document.getElementById('scanStatusText');

  statusText.innerText = "🔄 Đang bật Camera...";

  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 640, height: 480, facingMode: "user" } 
    });
    videoElement.srcObject = webcamStream;
    statusText.innerText = "🔄 Đang quét Face ID...";

    setTimeout(() => {
      const user = getCurrentUser();
      statusText.innerText = `✅ Nhận diện: ${user.name}!`;
      setLockState(false, `Mở cửa bởi ${user.name}`, "Face ID App");
      
      setTimeout(() => {
        closeCameraPanel();
      }, 2000);
    }, 1500);

  } catch (err) {
    console.error("Lỗi camera:", err);
    statusText.innerText = "⚠️ Lỗi truy cập Camera!";
  }
}

function closeCameraPanel() {
  if (webcamStream) {
    webcamStream.getTracks().forEach(t => t.stop());
    webcamStream = null;
    document.getElementById('webcamStream').srcObject = null;
  }
  document.getElementById('cameraPanelCard').style.display = 'none';
}

function handleLockToggle() {
  if (isLocked) {
    alert("⚠️ Vui lòng mở cửa bằng 1 trong 2 phương thức (Nhập PIN hoặc Quét khuôn mặt)!");
    return;
  }
  const user = getCurrentUser();
  setLockState(true, `Đã khóa cửa bởi ${user.name}`, "Thủ công App");
}

function setLockState(newLockedState, actionText, sourceText) {
  isLocked = newLockedState;
  
  clearAutoLockTimer();
  updateUIState();
  addLogToUI(actionText, sourceText, getCurrentTime());

  try {
    database.ref('device/isLocked').set(isLocked);
    database.ref('logs').push({
      action: actionText,
      source: sourceText,
      time: getCurrentTime(),
      timestamp: Date.now()
    });
  } catch (e) {
    console.log("Firebase sync skipped");
  }

  if (!isLocked) {
    startAutoLockTimer();
  }
}

function startAutoLockTimer() {
  autoLockCountdown = 10;
  updateCountdownUI();

  countdownInterval = setInterval(() => {
    autoLockCountdown--;
    updateCountdownUI();

    if (autoLockCountdown <= 0) {
      clearAutoLockTimer();
      setLockState(true, "Tự động khóa sau 10s", "Hệ thống");
    }
  }, 1000);
}

function clearAutoLockTimer() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function updateCountdownUI() {
  const stateTag = document.getElementById('doorStateTag');
  const lockBtnText = document.getElementById('lockBtnText');
  
  if (!isLocked && stateTag && lockBtnText) {
    stateTag.innerText = `CỬA ĐANG MỞ (${autoLockCountdown}s)`;
    lockBtnText.innerText = `BẤM ĐỂ KHÓA CỬA (${autoLockCountdown}s)`;
  }
}

// 3. TÙY CHỌN MỞ BẰNG PIN TRÊN APP (Cần Internet)
function openPinModal() {
  if (!checkOnlineBeforeAction("Nhập mã PIN mở cửa qua App")) return;

  if (!isLocked) {
    alert("Cửa hiện tại đã mở sẵn!");
    return;
  }
  if (isLockedOut) {
    alert("⛔ Hệ thống đang bị khóa do nhập sai quá 3 lần!");
    return;
  }
  const user = getCurrentUser();
  document.getElementById('pinUserDisplay').innerText = `Đang nhập PIN cho: ${user.name}`;
  document.getElementById('pinModal').style.display = 'flex';
  clearPin();
}

function closePinModal() { 
  document.getElementById('pinModal').style.display = 'none'; 
  clearPin(); 
}

function pressNum(num) {
  if (currentInputPin.length < 4 && !isLockedOut) {
    currentInputPin += num;
    updatePinDots();
  }
}

function clearPin() { 
  currentInputPin = ""; 
  updatePinDots(); 
  document.getElementById('pinErrorText').innerText = ""; 
}

function updatePinDots() {
  document.querySelectorAll('.pin-dot').forEach((dot, idx) => {
    if (idx < currentInputPin.length) dot.classList.add('active');
    else dot.classList.remove('active');
  });
}

function submitPin() {
  if (currentInputPin.length < 4) { 
    document.getElementById('pinErrorText').innerText = "Nhập đủ 4 số!"; 
    return; 
  }

  const user = getCurrentUser();

  if (currentInputPin === user.pin) {
    failedAttempts = 0;
    closePinModal();
    setLockState(false, `Mở cửa bởi ${user.name}`, "Mã PIN App");
  } else {
    failedAttempts++;
    const content = document.querySelector('.modal-content');
    content.classList.add('shake');
    setTimeout(() => content.classList.remove('shake'), 400);

    if (failedAttempts >= 3) {
      triggerSecurityAlarm(user);
    } else {
      document.getElementById('pinErrorText').innerText = `Sai PIN! Lần (${failedAttempts}/3)`;
      addLogToUI(`⚠️ ${user.name} nhập sai PIN App lần ${failedAttempts}`, "Bảo mật App", getCurrentTime());
      clearPin();
    }
  }
}

function triggerSecurityAlarm(user) {
  isLockedOut = true;
  document.getElementById('pinErrorText').innerText = "⛔ Sai 3 lần! Khóa 30 giây.";
  addLogToUI(`🚨 CẢNH BÁO: ${user.name} nhập sai PIN App quá 3 lần!`, "An ninh App", getCurrentTime());

  let countdown = 30;
  const timer = setInterval(() => {
    countdown--;
    document.getElementById('pinErrorText').innerText = `⛔ Khóa hệ thống: ${countdown}s`;
    if (countdown <= 0) {
      clearInterval(timer);
      isLockedOut = false;
      failedAttempts = 0;
      clearPin();
    }
  }, 1000);
}

function updateUIState() {
  const lockBtn = document.getElementById('lockBtn');
  const lockIcon = document.getElementById('lockIcon');
  const lockBtnText = document.getElementById('lockBtnText');
  const stateTag = document.getElementById('doorStateTag');
  const relayLed = document.getElementById('relayLed');

  if (!lockBtn) return;

  if (isLocked) {
    lockBtn.className = 'btn-lock locked';
    lockIcon.className = 'fa-solid fa-lock';
    lockBtnText.innerText = 'CỬA ĐANG KHÓA (CHỌN PHƯƠNG THỨC MỞ)';
    stateTag.className = 'state-tag locked';
    stateTag.innerText = 'CỬA ĐANG KHÓA';
    lockBtn.style.cursor = 'not-allowed';
    lockBtn.style.opacity = '0.85';

    if (relayLed) {
      relayLed.className = 'ind-led locked';
      relayLed.innerText = 'CLOSED (LOCKED)';
    }
  } else {
    lockBtn.className = 'btn-lock unlocked';
    lockIcon.className = 'fa-solid fa-unlock';
    lockBtnText.innerText = `BẤM ĐỂ KHÓA CỬA (${autoLockCountdown}s)`;
    stateTag.className = 'state-tag unlocked';
    stateTag.innerText = `CỬA ĐANG MỞ (${autoLockCountdown}s)`;
    lockBtn.style.cursor = 'pointer';
    lockBtn.style.opacity = '1';

    if (relayLed) {
      relayLed.className = 'ind-led unlocked';
      relayLed.innerText = 'OPEN (UNLOCKED)';
    }
  }

  if (typeof update3DDoorState === 'function') {
    update3DDoorState(isLocked);
  }
}

function addLogToUI(action, source, time) {
  const logList = document.getElementById('logList');
  if (!logList) return;
  const item = document.createElement('div');
  item.className = 'log-item';
  item.innerHTML = `<span><strong>${time}</strong> - ${action}</span><span>${source}</span>`;
  logList.insertBefore(item, logList.firstChild);
}

// Cập nhật trạng thái phần cứng ESP32
function setESPStatusUI(online) {
  const badge = document.getElementById('esp32Badge');
  const text = document.getElementById('esp32Text');
  if (!badge) return;
  
  if (online) {
    badge.className = 'esp-status online';
    text.innerText = 'ESP32: Trực tuyến';
    badge.title = "Phần cứng ESP32 đang kết nối Internet. Có thể điều khiển từ xa.";
  } else {
    badge.className = 'esp-status offline';
    text.innerText = 'ESP32: Ngoại tuyến';
    badge.title = "Phần cứng ESP32 đã mất kết nối! Tính năng từ xa bị vô hiệu hóa.";
  }
}

function toggleSimulatedESP() {
  isESPOnline = !isESPOnline;
  setESPStatusUI(isESPOnline);
  try {
    database.ref('device/online').set(isESPOnline);
  } catch(e) {}
}

function getCurrentTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function clearLogs() { document.getElementById('logList').innerHTML = ''; }