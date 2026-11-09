import html.parser
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_FILES = ("index.html", "styles.css", "app.js")
EXPECTED_ACTIVITY_NAMES = {
    "등교하기",
    "외투와 가방 정리하기",
    "아침 활동",
    "1교시",
    "쉬는 시간",
    "2교시",
    "점심시간",
    "오후 수업",
    "방과후 활동",
    "하교 준비하기",
    "하교하기",
}


class AppHTMLParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.external_references = []
        self.input_names = []

    def handle_starttag(self, tag, attrs):
        attributes = {name.lower(): value or "" for name, value in attrs}
        if tag.lower() == "script":
            self.scripts.append(attributes)
        for attribute in ("src", "href", "action", "poster"):
            value = attributes.get(attribute, "")
            if re.match(r"(?i)^https?://", value):
                self.external_references.append(value)
        if tag.lower() == "input" and attributes.get("name"):
            self.input_names.append(attributes["name"])


def source(name):
    return (ROOT / name).read_text(encoding="utf-8")


def balanced_segment(text, start, opening="[", closing="]"):
    depth = 0
    quote = None
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in "'\"`":
            quote = char
        elif char == opening:
            depth += 1
        elif char == closing:
            depth -= 1
            if depth == 0:
                return text[start : index + 1]
    return ""


def top_level_items(array):
    items = []
    start = 1
    depths = {"{": 0, "[": 0, "(": 0}
    pairs = {"}": "{", "]": "[", ")": "("}
    quote = None
    escaped = False
    for index, char in enumerate(array[1:-1], start=1):
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in "'\"`":
            quote = char
        elif char in depths:
            depths[char] += 1
        elif char in pairs:
            depths[pairs[char]] -= 1
        elif char == "," and not any(depths.values()):
            if array[start:index].strip():
                items.append(array[start:index].strip())
            start = index + 1
    if array[start:-1].strip():
        items.append(array[start:-1].strip())
    return items


class StaticAppContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        missing = [name for name in APP_FILES if not (ROOT / name).is_file()]
        if missing:
            raise unittest.SkipTest("앱 파일이 아직 없습니다: " + ", ".join(missing))
        cls.html = source("index.html")
        cls.css = source("styles.css")
        cls.js = source("app.js")
        cls.all_source = "\n".join((cls.html, cls.css, cls.js))
        cls.parser = AppHTMLParser()
        cls.parser.feed(cls.html)

    def test_uses_no_external_http_resources(self):
        self.assertEqual([], self.parser.external_references)
        for filename, content in zip(APP_FILES, (self.html, self.css, self.js)):
            self.assertNotRegex(content, r"(?i)https?://", f"{filename}에 외부 URL이 있습니다")

    def test_loads_app_script_with_defer(self):
        matching = [
            script
            for script in self.parser.scripts
            if re.search(r"(?:^|/)app\.js(?:[?#].*)?$", script.get("src", ""))
        ]
        self.assertEqual(1, len(matching), "app.js는 한 번만 로드해야 합니다")
        self.assertIn("defer", matching[0], "app.js는 defer 속성으로 로드해야 합니다")

    def test_persists_state_under_one_local_storage_key(self):
        constants = {
            name: value
            for name, _, value in re.findall(
                r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['\"])([^'\"]+)\2",
                self.js,
            )
        }
        calls = re.findall(
            r"localStorage\s*\.\s*(getItem|setItem|removeItem)\s*\(\s*"
            r"(?:(['\"])([^'\"]+)\2|([A-Za-z_$][\w$]*))",
            self.js,
        )
        keys_by_method = {}
        for method, _, literal, identifier in calls:
            key = literal or constants.get(identifier)
            if key:
                keys_by_method.setdefault(method, set()).add(key)
        self.assertTrue(keys_by_method.get("getItem"), "localStorage에서 상태를 읽어야 합니다")
        self.assertTrue(keys_by_method.get("setItem"), "localStorage에 상태를 저장해야 합니다")
        common = keys_by_method["getItem"] & keys_by_method["setItem"]
        self.assertEqual(1, len(common), "읽기와 쓰기에 같은 하나의 고정 키를 사용해야 합니다")

    def test_defines_eleven_named_default_activities(self):
        declaration = re.search(
            r"\b(?:DEFAULT_ACTIVITIES|defaultActivities)\b\s*=\s*\[",
            self.js,
        )
        self.assertIsNotNone(declaration, "기본 활동 배열을 찾을 수 없습니다")
        start = self.js.find("[", declaration.start())
        array = balanced_segment(self.js, start)
        self.assertTrue(array, "기본 활동 배열의 대괄호가 닫히지 않았습니다")
        activity_names = []
        for item in top_level_items(array):
            string_item = re.fullmatch(r"(['\"])(.*?)\1", item, flags=re.DOTALL)
            named_item = re.search(
                r"\b(?:name|title|label)\s*:\s*(['\"])(.*?)\1",
                item,
                flags=re.DOTALL,
            )
            if string_item:
                activity_names.append(string_item.group(2).strip())
            elif named_item:
                activity_names.append(named_item.group(2).strip())
        self.assertEqual(11, len(activity_names), "기본 활동명은 11개여야 합니다")
        self.assertEqual(11, len(set(activity_names)), "기본 활동명은 서로 달라야 합니다")
        self.assertTrue(all(activity_names), "빈 활동명이 없어야 합니다")
        self.assertEqual(
            EXPECTED_ACTIVITY_NAMES,
            set(activity_names),
            "요청된 기본 활동명 11개가 정확히 들어 있어야 합니다",
        )

    def test_exposes_required_user_actions_and_screens(self):
        for label in ("완료", "힌트", "이전", "다시 하기", "초기화", "기본 예시 복원"):
            with self.subTest(label=label):
                self.assertIn(label, self.all_source)
        screen_terms = ("시작", "활동", "완료")
        for term in screen_terms:
            with self.subTest(screen=term):
                self.assertIn(term, self.all_source)

    def test_uses_browser_speech_synthesis(self):
        self.assertIn("speechSynthesis", self.js)

    def test_speech_is_off_by_default_and_user_controlled(self):
        self.assertRegex(
            self.js,
            r"\bspeechEnabled\s*:\s*false\b",
            "음성 안내의 기본값은 꺼짐이어야 합니다",
        )
        self.assertIn("speechEnabled", self.js)
        self.assertIn("음성 켜기", self.all_source)
        self.assertIn("음성 끄기", self.all_source)

        calls = list(re.finditer(r"\bspeechSynthesis\s*\.\s*speak\s*\(", self.js))
        self.assertTrue(calls, "브라우저 음성합성 호출이 필요합니다")
        for call in calls:
            nearby_code = self.js[max(0, call.start() - 1500) : call.start()]
            with self.subTest(position=call.start()):
                self.assertRegex(
                    nearby_code,
                    r"if\s*\([^)]*speechEnabled|speechEnabled\s*(?:===?\s*true|&&)",
                    "음성합성 호출은 speechEnabled 조건으로 보호해야 합니다",
                )

    def test_has_no_personal_information_input_names(self):
        forbidden = re.compile(
            r"(?i)(?:^|[-_])(name|email|e-mail|phone|tel|mobile|photo|avatar|profile)(?:$|[-_])"
        )
        offenders = [name for name in self.parser.input_names if forbidden.search(name)]
        self.assertEqual([], offenders, f"개인정보 입력 name이 있습니다: {offenders}")

    def test_css_accessibility_and_responsiveness_contract(self):
        heights = [
            float(value)
            for value in re.findall(r"min-height\s*:\s*(\d+(?:\.\d+)?)px", self.css, re.I)
        ]
        self.assertTrue(any(value >= 56 for value in heights), "56px 이상의 최소 높이가 필요합니다")
        self.assertRegex(self.css, r":focus-visible\b")
        self.assertRegex(self.css, r"@media\s*\([^)]*(?:max|min)-width\s*:")
        self.assertRegex(self.css, r"@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)")

    def test_javascript_has_balanced_delimiters(self):
        pairs = {"(": ")", "[": "]", "{": "}"}
        closing = set(pairs.values())
        stack = []
        quote = None
        escaped = False
        line_comment = False
        block_comment = False
        index = 0
        while index < len(self.js):
            char = self.js[index]
            following = self.js[index + 1] if index + 1 < len(self.js) else ""
            if line_comment:
                line_comment = char != "\n"
            elif block_comment:
                if char == "*" and following == "/":
                    block_comment = False
                    index += 1
            elif quote:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == quote:
                    quote = None
            elif char == "/" and following == "/":
                line_comment = True
                index += 1
            elif char == "/" and following == "*":
                block_comment = True
                index += 1
            elif char in "'\"`":
                quote = char
            elif char in pairs:
                stack.append(char)
            elif char in closing:
                self.assertTrue(stack, f"짝이 없는 닫는 기호: {char}")
                opening = stack.pop()
                self.assertEqual(pairs[opening], char, f"기호 순서가 맞지 않습니다: {opening}{char}")
            index += 1
        self.assertIsNone(quote, "닫히지 않은 문자열이 있습니다")
        self.assertFalse(block_comment, "닫히지 않은 블록 주석이 있습니다")
        self.assertEqual([], stack, f"닫히지 않은 기호가 있습니다: {stack}")


if __name__ == "__main__":
    unittest.main()
