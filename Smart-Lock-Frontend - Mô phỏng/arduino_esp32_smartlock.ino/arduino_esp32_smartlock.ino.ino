#include <WiFi.h>
#include <FirebaseESP32.h>

#define WIFI_SSID "TÊN_WIFI_NHÀ_BẠN"
#define WIFI_PASSWORD "MẬT_KHẨU_WIFI"

#define FIREBASE_HOST "https://smart-lock-demo-d9fd4-default-rtdb.firebaseio.com"

#define RELAY_PIN 2   // Chân GPIO điều khiển Rơ-le khóa cửa
#define BUZZER_PIN 4  // Chân GPIO điều khiển Còi báo động (Buzzer)

FirebaseData firebaseData;

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // Kết nối Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Đang kết nối Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nĐã kết nối Wi-Fi thành công!");

  // Khởi tạo Firebase
  Firebase.begin(FIREBASE_HOST, "");
  Firebase.reconnectWiFi(true);

  // Báo trạng thái ESP32 Online lên Firebase
  Firebase.setBool(firebaseData, "/device/online", true);
}

void loop() {
  // 1. Lắng nghe trạng thái Khóa cửa từ Firebase
  if (Firebase.getBool(firebaseData, "/device/isLocked")) {
    bool isLocked = firebaseData.boolData();

    if (isLocked) {
      digitalWrite(RELAY_PIN, LOW);  // Đóng chốt khóa
      Serial.println("Trạng thái: CỬA ĐÃ KHÓA");
    } else {
      digitalWrite(RELAY_PIN, HIGH); // Mở chốt khóa
      Serial.println("Trạng thái: CỬA ĐÃ MỞ");
    }
  }

  // 2. Lắng nghe trạng thái Báo động khẩn cấp (khi nhập sai PIN 3 lần)
  if (Firebase.getBool(firebaseData, "/device/alarm/active")) {
    bool alarmActive = firebaseData.boolData();
    if (alarmActive) {
      digitalWrite(BUZZER_PIN, HIGH); // Bật còi hú
      Serial.println("🚨 CẢNH BÁO: Kích hoạt còi hú!");
    } else {
      digitalWrite(BUZZER_PIN, LOW);  // Tắt còi
      Serial.println("Hệ thống an toàn: Tắt còi.");
    }
  }

  delay(300);
}