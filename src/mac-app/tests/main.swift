import Foundation

func check(_ condition: Bool, _ label: String) {
    precondition(condition, label)
    print("PASS: \(label)")
}
func message(_ json: String, _ status: Int = 200, _ model: String = "qwen3:4b") -> String {
    LocalModelStatus.message(data: Data(json.utf8), statusCode: status, model: model)
}
check(LocalModelStatus.message(data: nil, statusCode: nil, model: "qwen3:4b").contains("연결 안 됨"), "missing runtime")
check(message("{}", 302).contains("연결 안 됨"), "redirect not readiness")
check(message("oops").contains("연결 안 됨"), "invalid response")
check(message("{\"models\":[]}").contains("모델 준비 필요"), "empty models")
check(message("{\"models\":[{\"name\":\"other:latest\"}]}").contains("모델 준비 필요"), "wrong model")
check(message("{\"models\":[{\"name\":\"qwen3:4b\"}]}").contains("설치 확인"), "installed model")
check(message("{\"models\":[{\"name\":\"qwen3:latest\"}]}", 200, "qwen3").contains("설치 확인"), "default latest tag")
check(message("{\"models\":[{\"name\":\"qwen3:4b\"}]}").contains("아직 확인하지"), "not claiming inference")

let fakeToken = String(repeating: "a", count: 43)
func fakeMail(_ url: String, kind: String = "verify", email: String = "fake@example.invalid", expiry: String = "2099-01-01T00:00:00.000Z") -> Data {
    try! JSONSerialization.data(withJSONObject: ["url":url,"kind":kind,"to":email,"expiresAt":expiry])
}
let localLink = "http://127.0.0.1:5601/#/verify?token=\(fakeToken)"
check(LocalVerificationLink.parse(fakeMail(localLink), email:"fake@example.invalid") != nil, "local verification only")
check(LocalVerificationLink.parse(fakeMail(localLink), email:"other@example.invalid") == nil, "email mismatch")
check(LocalVerificationLink.parse(fakeMail(localLink, kind:"reset"), email:"fake@example.invalid") == nil, "no password reset links")
check(LocalVerificationLink.parse(fakeMail(localLink, expiry:"2000-01-01T00:00:00.000Z"), email:"fake@example.invalid") == nil, "expired link")
check(LocalVerificationLink.parse(fakeMail("https://example.com/#/verify?token=\(fakeToken)"), email:"fake@example.invalid") == nil, "external origin refused")
check(LocalVerificationLink.parse(fakeMail(localLink+"&next=https://example.com"), email:"fake@example.invalid") == nil, "extra parameters refused")

check((try? LocalDevelopmentProfile.storageName(info: nil, data: nil)) == "Ahmatda", "default storage unchanged")
let devTag = "development-whisper-pyav-lgpl-v1"
let devProfile = Data("{\"version\":1,\"profile\":\"development-whisper-pyav-lgpl-v1\"}".utf8)
check((try? LocalDevelopmentProfile.storageName(info: devTag, data: devProfile)) == "Ahmatda-PyAV-Dev", "explicit development storage")
check((try? LocalDevelopmentProfile.storageName(info: nil, data: devProfile)) == nil, "profile needs plist agreement")
check((try? LocalDevelopmentProfile.storageName(info: devTag, data: nil)) == nil, "plist needs profile agreement")
check((try? LocalDevelopmentProfile.storageName(info: "other", data: devProfile)) == nil, "unknown profile rejected")
check((try? LocalDevelopmentProfile.storageName(info: devTag, data: Data("{\"version\":true,\"profile\":\"development-whisper-pyav-lgpl-v1\"}".utf8))) == nil, "boolean version rejected")
