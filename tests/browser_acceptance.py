import json
import os
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from playwright.sync_api import Browser, Page, sync_playwright


BASE_URL = os.environ.get("ANIMOSORT_BASE_URL", "http://127.0.0.1:4173")
ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "comprehensive-eaf" / "comprehensive-eaf.pdf"
PROFILE_STORAGE_KEY = "animosort_customization_profiles_v1"


def label_for_minutes(minutes: int) -> str:
    hours24, minute = divmod(minutes, 60)
    period = "PM" if hours24 >= 12 else "AM"
    hours12 = hours24 % 12 or 12
    return f"{hours12}:{minute:02d} {period}"


def meeting(
    meeting_id: str,
    course_code: str,
    section: str,
    title: str,
    day: str | None,
    start: int | None,
    end: int | None,
    location: str | None,
    modality: str,
    scheduled: bool = True,
) -> dict[str, object]:
    return {
        "id": meeting_id,
        "courseCode": course_code,
        "title": title,
        "section": section,
        "credits": 3,
        "day": day if scheduled else None,
        "startMinutes": start if scheduled else None,
        "endMinutes": end if scheduled else None,
        "startLabel": label_for_minutes(start) if scheduled and start is not None else None,
        "endLabel": label_for_minutes(end) if scheduled and end is not None else None,
        "location": location if scheduled else None,
        "expandedLocation": location if scheduled else None,
        "modality": modality,
        "scheduled": scheduled,
    }


def schedule(*meetings: dict[str, object]) -> dict[str, object]:
    return {"session": "AY 2026-2027 Term 1", "meetings": list(meetings)}


def load_schedule(page: Page, source: dict[str, object]) -> None:
    page.evaluate(
        """async (value) => {
            const app = await import('./assets/js/app.js?v=0.4.7');
            app.replaceSchedule(value);
        }""",
        source,
    )
    page.locator("#schedule-panel").wait_for(state="visible")


@contextmanager
def app_page(
    browser: Browser,
    source: dict[str, object] | None = None,
    width: int = 390,
) -> Iterator[Page]:
    context = browser.new_context(
        viewport={"width": width, "height": 844},
        reduced_motion="reduce",
        accept_downloads=True,
    )
    page = context.new_page()
    page_errors: list[str] = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.goto(f"{BASE_URL}/index.html", wait_until="networkidle")
    if source is not None:
        load_schedule(page, source)
    try:
        yield page
        assert not page_errors, page_errors
    finally:
        context.close()


def open_meeting(page: Page, meeting_id: str) -> None:
    block = page.locator(f'[data-meeting-id="{meeting_id}"]')
    if block.count():
        block.click()
    else:
        code, section, _ = meeting_id.split("::")
        item = page.locator(".manual-details-item").filter(has_text=f"{code} {section}")
        assert item.count() == 1, f"Could not find {meeting_id} in the manual-details list"
        item.get_by_role("button", name="Edit details").click()
    page.locator("#customization-dialog").wait_for(state="visible")


def mode(page: Page, value: str) -> None:
    labels = {"inherit": "Automatic", "f2f": "F2F", "online": "Online"}
    page.locator("label.customization-mode-option").filter(has_text=labels[value]).click()


def scope(page: Page, value: str) -> None:
    labels = {"meeting": "This meeting", "pair": "Paired meetings"}
    page.locator("label.customization-scope-option").filter(has_text=labels[value]).click()


def save(page: Page) -> None:
    page.locator("#save-customization-btn").click()
    validation = page.locator("#customization-validation")
    if validation.is_visible():
        raise AssertionError(validation.inner_text())
    page.locator("#customization-dialog").wait_for(state="hidden")


def profile(page: Page) -> dict[str, object]:
    value = page.evaluate(
        "key => JSON.parse(localStorage.getItem(key) || 'null')",
        PROFILE_STORAGE_KEY,
    )
    assert isinstance(value, dict), "Expected a persisted customization profile"
    active_id = value["activeProfileId"]
    active = next(item for item in value["profiles"] if item["id"] == active_id)
    return active["profile"]


def section_profile(page: Page, key: str) -> dict[str, object]:
    result = profile(page)["sections"].get(key, {})
    assert isinstance(result, dict)
    return result


def assert_no_horizontal_overflow(page: Page) -> None:
    assert page.evaluate(
        "() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"
    )


def test_fixture_import_and_async_override(browser: Browser) -> None:
    with app_page(browser, width=390) as page:
        page.locator("#eaf-file").set_input_files(str(FIXTURE))
        page.locator("#manual-details-panel").wait_for(state="visible", timeout=60_000)
        manual_text = page.locator("#manual-details-list").inner_text()
        assert "NSTP101 N101" in manual_text
        assert "Async · no fixed time" in manual_text
        assert page.locator("#schedule-canvas .meeting-block").count() == 40
        for meeting_id, building_name in (
            ("LAGMM1::MM1::0", "St. Mutien Marie Hall"),
            ("LAGBOX1::MB1::0", "St. Mutien Marie Hall"),
            ("LAGMRR1::MR1::0", "Milagros R. del Rosario Building"),
            ("LAGUH1::UH1::0", "University Hall"),
            ("LAGEKR1::EK1::0", "Enrique K. Razon Jr. Hall"),
            ("LAGRL1::RL1::0", "Richard L. Lee Engineering Technology Block"),
            ("LAGLC1::LC1::0", "Integrated School Learning Centers"),
            ("LAGLC2::LC2::0", "Integrated School Learning Centers"),
        ):
            assert building_name in page.locator(f'[data-meeting-id="{meeting_id}"]').inner_text()

        open_meeting(page, "NSTP101::N101::0")
        assert page.locator("input[name='customization-mode'][value='inherit']").is_checked()
        assert page.locator("#customization-start-time").input_value() == ""
        assert page.locator("#customization-end-time").input_value() == ""
        assert page.locator("#customization-room").is_disabled()

        page.locator("#customization-course-code").fill("NSTP")
        page.locator("#customization-title").fill("Community Engagement")
        page.locator("#customization-day").select_option("MON")
        page.locator("#customization-start-time").fill("10:30 PM")
        page.locator("#customization-end-time").fill("11:00 PM")
        mode(page, "online")
        page.locator("#customization-room").fill("Zoom")
        save(page)

        assert page.locator("#manual-details-panel").is_hidden()
        assert page.locator("#schedule-canvas .meeting-block").count() == 41
        card = page.locator('[data-meeting-id="NSTP101::N101::0"]')
        card_text = card.inner_text()
        assert "NSTP" in card_text
        assert "Community Engagement" in card_text
        assert "Mode: Online · Zoom" in card_text
        assert "10:30 PM - 11:00 PM" in card_text
        stored = section_profile(page, "NSTP101::N101")
        stored_text = json.dumps(stored)
        assert '"courseCode": "NSTP"' in stored_text
        assert '"title": "Community Engagement"' in stored_text


PAIR_VARIATION = schedule(
    meeting("VAR01::S01::0", "VAR01", "S01", "VARIED PAIR", "MON", 480, 570, "A101", "room"),
    meeting("VAR01::S01::1", "VAR01", "S01", "VARIED PAIR", "THU", 600, 690, "B202", "room"),
)


def test_pair_scope_keeps_eaf_variations(browser: Browser) -> None:
    with app_page(browser, PAIR_VARIATION) as page:
        open_meeting(page, "VAR01::S01::0")
        assert page.locator("#customization-scope-pair").is_checked()
        assert page.locator("#customization-sync-conflict").is_hidden()
        assert "Automatic keeps each meeting's EAF schedule." in page.locator("#customization-pair-status").inner_text()

        page.locator("#customization-title").fill("Shared title")
        save(page)
        first = page.locator('[data-meeting-id="VAR01::S01::0"]')
        second = page.locator('[data-meeting-id="VAR01::S01::1"]')
        assert "Shared title" in first.inner_text()
        assert "Shared title" in second.inner_text()
        assert "8:00 AM - 9:30 AM" in first.inner_text()
        assert "10:00 AM - 11:30 AM" in second.inner_text()
        stored = section_profile(page, "VAR01::S01")
        assert stored["title"] == "Shared title"
        assert "time" not in stored
        assert "room" not in stored


CONFLICT_PAIR = schedule(
    meeting("CONFLICT::S01::0", "CONFLICT", "S01", "CONFLICT CLASS", "MON", 480, 570, "G101", "room"),
    meeting("CONFLICT::S01::1", "CONFLICT", "S01", "CONFLICT CLASS", "THU", 480, 570, "G101", "room"),
)


def set_independent_online_override(page: Page) -> None:
    scope(page, "meeting")
    mode(page, "online")
    page.locator("#customization-room").fill("Zoom")
    save(page)


def test_conflict_cancel_and_winner_choices(browser: Browser) -> None:
    with app_page(browser, CONFLICT_PAIR) as page:
        open_meeting(page, "CONFLICT::S01::0")
        set_independent_online_override(page)
        before_cancel = profile(page)

        open_meeting(page, "CONFLICT::S01::0")
        scope(page, "pair")
        page.locator("#customization-sync-conflict").wait_for(state="visible")
        diff_text = page.locator("#customization-sync-diff").inner_text()
        assert "Delivery" in diff_text
        assert "Room" in diff_text
        assert "Zoom" in diff_text
        assert "G101" in diff_text
        page.locator('[data-sync-choice="cancel"]').click()
        page.locator("#customization-sync-conflict").wait_for(state="hidden")
        assert page.locator("#customization-scope-meeting").is_checked()
        assert page.evaluate("() => document.activeElement.id") == "customization-scope-meeting"
        assert profile(page) == before_cancel

        scope(page, "pair")
        page.locator("#customization-sync-conflict").wait_for(state="visible")
        page.locator('[data-sync-choice="use-pair"]').click()
        assert page.locator("#customization-sync-conflict").is_hidden()
        assert page.locator("#customization-scope-pair").is_checked()
        assert page.locator("#customization-room").input_value() == "G101"
        save(page)
        assert "CONFLICT::S01::0" not in section_profile(page, "CONFLICT::S01").get("meetings", {})

        open_meeting(page, "CONFLICT::S01::0")
        set_independent_online_override(page)
        open_meeting(page, "CONFLICT::S01::0")
        scope(page, "pair")
        page.locator("#customization-sync-conflict").wait_for(state="visible")
        page.locator('[data-sync-choice="use-current-for-pair"]').click()
        assert page.locator("#customization-scope-pair").is_checked()
        assert page.locator("#customization-room").input_value() == "Zoom"
        save(page)
        assert "Mode: Online · Zoom" in page.locator('[data-meeting-id="CONFLICT::S01::0"]').inner_text()
        assert "Mode: Online · Zoom" in page.locator('[data-meeting-id="CONFLICT::S01::1"]').inner_text()
        stored = section_profile(page, "CONFLICT::S01")
        assert stored["mode"] == "online"
        assert stored["room"] == "Zoom"
        assert "meetings" not in stored


ONLINE_PAIR = schedule(
    meeting("ONLINE::S01::0", "ONLINE", "S01", "ONLINE CLASS", "MON", 480, 570, "Canvas", "online"),
    meeting("ONLINE::S01::1", "ONLINE", "S01", "ONLINE CLASS", "THU", 480, 570, "Online", "online"),
)


def test_mode_boundaries_and_automatic_restore(browser: Browser) -> None:
    with app_page(browser, ONLINE_PAIR) as page:
        open_meeting(page, "ONLINE::S01::0")
        mode(page, "f2f")
        assert page.locator("#customization-room-label").inner_text() == "Room"
        assert page.locator("#customization-room").input_value() == ""
        page.locator("#customization-room").fill("")
        save(page)
        f2f_card_text = page.locator('[data-meeting-id="ONLINE::S01::0"]').inner_text()
        assert "Room: Room not specified · F2F" in f2f_card_text, f2f_card_text

        open_meeting(page, "ONLINE::S01::0")
        mode(page, "inherit")
        assert page.locator("#customization-room-label").inner_text() == "Platform or link"
        assert page.locator("#customization-room").input_value() == "Canvas"
        assert "full http:// or https:// URL" in page.locator("#customization-room-help").inner_text()
        save(page)
        assert "Mode: Online · Canvas" in page.locator('[data-meeting-id="ONLINE::S01::0"]').inner_text()
        assert "Room: Room not specified" not in page.locator('[data-meeting-id="ONLINE::S01::0"]').inner_text()


CALENDAR_SOURCE = schedule(
    meeting("CAL01::S01::0", "CAL01", "S01", "CALENDAR CLASS", "MON", 480, 570, "G404B", "room"),
    meeting("CAL01::S01::1", "CAL01", "S01", "CALENDAR CLASS", "THU", 480, 570, "G404B", "room"),
    meeting("ASYNC::S01::0", "ASYNC", "S01", "ASYNC CLASS", None, None, None, None, "async", False),
)


def test_calendar_and_png_downloads(browser: Browser) -> None:
    with app_page(browser, CALENDAR_SOURCE) as page:
        open_meeting(page, "CAL01::S01::0")
        scope(page, "meeting")
        mode(page, "online")
        page.locator("#customization-room").fill("https://zoom.us/j/123456789?pwd=demo")
        page.locator("#customization-day").select_option("FRI")
        page.locator("#customization-start-time").fill("1:00 PM")
        page.locator("#customization-end-time").fill("2:30 PM")
        save(page)
        card_text = page.locator('[data-meeting-id="CAL01::S01::0"]').inner_text()
        assert "Mode: Online · https://zoom.us/j/123456789?pwd=demo" in card_text
        assert "1:00 PM - 2:30 PM" in card_text
        calendar_serialization = page.evaluate(
            """async ({source, storedProfile}) => {
                try {
                    const calendar = await import('./assets/js/calendar.js');
                    const result = calendar.formatIcsCalendar(
                        source,
                        storedProfile,
                        {startDate: '2026-08-28', endDate: '2026-08-28'},
                    );
                    return {ok: true, exportedCount: result.exportedCount, length: result.icsText.length};
                } catch (error) {
                    return {ok: false, name: error.name, code: error.code, message: error.message};
                }
            }""",
            {"source": CALENDAR_SOURCE, "storedProfile": profile(page)},
        )
        assert calendar_serialization["ok"], calendar_serialization

        page.locator("#calendar-export-toggle").click()
        page.locator("#calendar-export-controls").wait_for(state="visible")
        page.locator("#calendar-start-date").fill("2026-08-28")
        page.locator("#calendar-end-date").fill("2026-08-28")
        assert page.locator("#download-calendar-btn").is_enabled()
        page.locator("#download-calendar-btn").click()
        page.locator("#calendar-export-dialog").wait_for(state="visible")
        with page.expect_download(timeout=60_000) as calendar_download:
            page.locator("#confirm-calendar-export-btn").click()
        ics = Path(calendar_download.value.path()).read_text(encoding="utf-8").replace("\r\n ", "").replace("\n ", "")
        assert "SUMMARY:CAL01 S01 - CALENDAR CLASS" in ics
        assert "DTSTART;TZID=Asia/Manila:20260828T130000" in ics
        assert "DTEND;TZID=Asia/Manila:20260828T143000" in ics
        assert "LOCATION:Online" in ics
        assert "URL:https://zoom.us/j/123456789?pwd=demo" in ics
        assert "DESCRIPTION:Mode: Online\\nJoin link: https://zoom.us/j/123456789?pwd=demo\\nDay: Friday\\nTime: 1:00 PM - 2:30 PM" in ics
        assert "SUMMARY:ASYNC" not in ics

        with page.expect_download(timeout=60_000) as png_download:
            page.locator("#download-png-btn").click()
        assert png_download.value.suggested_filename == "animo-sort-schedule.png"
        assert Path(png_download.value.path()).read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"


def test_about_output_image(browser: Browser) -> None:
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        reduced_motion="reduce",
    )
    page = context.new_page()
    try:
        page.goto(f"{BASE_URL}/about.html", wait_until="networkidle")
        output = page.locator("#story-demo-output")
        output.wait_for(state="visible")
        assert output.get_attribute("src") == "assets/images/animosort-schedule-export.png"
        assert "fictional demonstration professor names" in (output.get_attribute("alt") or "")
        assert page.locator("#story-output-dialog-image").get_attribute("src") == "assets/images/animosort-schedule-export.png"

        page.locator("#story-output-trigger").click()
        page.locator("#story-output-dialog").wait_for(state="visible")
        assert "fictional demonstration labels" in page.locator("#story-output-dialog").inner_text()
        page.locator("#story-output-close").click()
        page.locator("#story-output-dialog").wait_for(state="hidden")
    finally:
        context.close()


def test_how_to_use_guide(browser: Browser) -> None:
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        reduced_motion="reduce",
    )
    page = context.new_page()
    try:
        page.goto(f"{BASE_URL}/how-to-use.html", wait_until="networkidle")
        assert page.locator("#building-codes").count() == 1
        figure_links = page.locator(".guide-figure-link")
        figure_images = page.locator(".guide-figure img")
        assert figure_links.count() == 5
        assert figure_images.count() == 5
        expected_images = {
            "assets/images/animosort-schedule-export.png",
            "assets/images/animosort-customization-editor.png",
            "assets/images/animosort-customization-color-picker.png",
            "assets/images/animosort-profile-controls.png",
            "assets/images/animosort-calendar-handoff.png",
        }
        assert set(page.locator(".guide-figure img").evaluate_all("images => images.map(image => image.getAttribute('src'))")) == expected_images
        assert set(page.locator(".guide-figure-link").evaluate_all("links => links.map(link => link.getAttribute('href'))")) == expected_images
        page.locator('[data-guide-target="building-codes"]').click()
        assert page.locator("#building-codes").evaluate("element => element.open")
        building_text = page.locator("#building-codes").inner_text()
        assert "St. Mutien Marie Hall" in building_text
        assert "Milagros R. del Rosario Building" in building_text
        assert "LC1 / LC2" in building_text
        assert "MM-BLACKBOX" in building_text
        assert_no_horizontal_overflow(page)

        page.locator('[data-guide-target="google-calendar"]').click()
        assert page.locator("#google-calendar").evaluate("element => element.open")
        calendar_text = page.locator("#google-calendar").inner_text()
        assert "standard URL field" in calendar_text
        assert "native Join button is not guaranteed" in calendar_text
    finally:
        context.close()


def test_focus_responsive_and_reduced_motion(browser: Browser) -> None:
    for width in (320, 390, 480, 768, 1024, 1440):
        with app_page(browser, PAIR_VARIATION, width=width) as page:
            open_meeting(page, "VAR01::S01::0")
            assert page.evaluate("() => document.activeElement.id") == "customization-course-code"
            assert_no_horizontal_overflow(page)
            page.keyboard.press("Escape")
            page.locator("#customization-dialog").wait_for(state="hidden")
            assert page.evaluate("() => document.activeElement.dataset.meetingId") == "VAR01::S01::0"


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        tests = [
            test_fixture_import_and_async_override,
            test_pair_scope_keeps_eaf_variations,
            test_conflict_cancel_and_winner_choices,
            test_mode_boundaries_and_automatic_restore,
            test_calendar_and_png_downloads,
            test_about_output_image,
            test_how_to_use_guide,
            test_focus_responsive_and_reduced_motion,
        ]
        for check in tests:
            check(browser)
            print(f"PASS {check.__name__}")
        browser.close()


if __name__ == "__main__":
    main()
