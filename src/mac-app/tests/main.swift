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

check(LocalGettingStartedStep.allCases.count == 7, "seven explicit setup steps")
check(Set(LocalGettingStartedStep.allCases.map { $0.title }).count == 7, "unique setup labels")
for step in LocalGettingStartedStep.allCases {
    check(LocalGettingStartedStep.selected(index: step.rawValue, confirmed: true) == step, "confirmed step maps explicitly")
    check(LocalGettingStartedStep.selected(index: step.rawValue, confirmed: false) == nil, "cancel never selects action")
    check(!step.detail.isEmpty, "each step explains its boundary")
}
check(LocalGettingStartedStep.selected(index: -1, confirmed: true) == nil, "invalid negative step")
check(LocalGettingStartedStep.selected(index: 7, confirmed: true) == nil, "invalid overflow step")
check(LocalGettingStartedStep.introduction.contains("완료 여부를 판정하지"), "guide does not claim completion")
check(LocalGettingStartedStep.orderModel.detail.contains("동의해야"), "model download requires confirmation")
check(LocalGettingStartedStep.speechModel.detail.contains("동의해야"), "speech download requires confirmation")
check(LocalGettingStartedStep.connection.detail.contains("권한을 부여하지"), "guide never grants worker authorization")
check(LocalGettingStartedStep.readiness.detail.contains("품질을 보장하지"), "installation not inference success")

check(LocalMacPreflight.capacity(nil) == "확인 불가", "unknown disk is not zero")
check(LocalMacPreflight.capacity(0) == "0.0 GB", "real zero disk remains zero")
check(LocalMacPreflight.capacity(1_500_000_000) == "1.5 GB", "decimal disk units")
check(LocalMacPreflight.capacity(17_179_869_184, binary: true) == "16.0 GiB", "binary memory units")
let unknownMac = LocalMacPreflight.report(os: nil, architecture: " ", memoryBytes: nil, freeBytes: nil)
check(unknownMac.contains("macOS: 확인 불가"), "unknown OS explicit")
check(unknownMac.contains("실행 아키텍처: 확인 불가"), "unknown arch explicit")
check(unknownMac.contains("남은 공간: 확인 불가"), "disk query failure explicit")
let knownMac = LocalMacPreflight.report(os: "26.6.1", architecture: "arm64", memoryBytes: 17_179_869_184, freeBytes: 500_000_000_000)
check(knownMac.contains("macOS: 26.6.1"), "actual OS shown")
check(knownMac.contains("실행 아키텍처: arm64"), "actual execution arch shown")
check(knownMac.contains("500.0 GB"), "free capacity shown without sufficiency inference")
check(knownMac.contains("지원된다는 판정은 아니"), "hardware inventory not support promise")
check(knownMac.contains("26.2") && knownMac.contains("macOS 14 지원"), "vendor OS constraint visible")
check(knownMac.contains("임시 파일") && knownMac.contains("별도로 필요"), "download estimate excludes installation overhead")
check(knownMac.contains("실제 전사·답변 생성 성공은 달라"), "not claiming inference from installation")
check(LocalGettingStartedStep.allCases.first == .preflight, "preflight before optional setup")
check(LocalGettingStartedStep.selected(index: 0, confirmed: false) == nil, "cancel preflight no action")

let usageRoot = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
try! FileManager.default.createDirectory(at: usageRoot.appendingPathComponent("whisper-small"), withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: usageRoot) }
let usageFile = usageRoot.appendingPathComponent("whisper-small/test")
try! Data(repeating: 1, count: 42).write(to: usageFile)
try! FileManager.default.createDirectory(at: usageRoot.appendingPathComponent(".whisper-verified-cache"), withIntermediateDirectories: true)
try! FileManager.default.linkItem(at: usageFile, to: usageRoot.appendingPathComponent(".whisper-verified-cache/shared"))
let usage = LocalModelStorageUsage.inspect(root: usageRoot)
check(usage[1].bytes == 42, "model location size counted")
check(usage[3].bytes == 0 && usage[3].sharedFiles == 1, "hardlink not double counted across categories")
check(usage[0].bytes == 0, "absent location zero not installed claim")
check(LocalModelStorageUsage.inspect(root: usageRoot, limit: 0)[1].bytes == nil, "bounded scan unknown when exceeded")
try! FileManager.default.createSymbolicLink(atPath: usageRoot.appendingPathComponent(".whisper-partial-cache").path, withDestinationPath: usageRoot.appendingPathComponent("whisper-small").path)
check(LocalModelStorageUsage.inspect(root: usageRoot)[4].bytes == nil, "directory symlink never followed")
try! FileManager.default.createSymbolicLink(atPath: usageRoot.appendingPathComponent("whisper-small/link").path, withDestinationPath: usageFile.path)
check(LocalModelStorageUsage.inspect(root: usageRoot)[1].bytes == nil, "child symlink marks category unknown")
check(LocalModelStorageUsage.report(usage).contains("재개 가능 여부는 검증하지"), "cache presence not validation")
check(LocalModelStorageUsage.report(usage).contains("실제 디스크 점유량"), "logical size caveat")

check(LocalModelStorageUsage.adding(UInt64.max, 1) == nil, "size overflow is unknown not wrapped")

check(TeamServerAddress.validated("https://team.example.com", confirmed: true)?.absoluteString == "https://team.example.com/", "server origin normalized")
check(TeamServerAddress.validated("https://team.example.com:8443/", confirmed: true)?.port == 8443, "explicit TLS port")
check(TeamServerAddress.validated("https://[::1]:8443", confirmed: true) != nil, "IPv6 origin allowed")
check(TeamServerAddress.validated("https://team.example.com", confirmed: false) == nil, "cancel no launch destination")
for bad in ["http://team.example.com", "https://user:secret@team.example.com", "https://user@team.example.com", "https://team.example.com/path", "https://team.example.com/?x=1", "https://team.example.com/#fragment", "https://team.example.com:0", "https://team.example.com:65536", "https://", "not a url", "https://te am.example.com", "https://team.example.com\\\\@evil.test", "https://.example.com", "https://-bad.example.com", "https://example..com", "https://team.example.com/%2e", "https://[bad::ipv6]"] {
    check(TeamServerAddress.validated(bad, confirmed: true) == nil, "invalid or ambiguous team URL refused")
}
