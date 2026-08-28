#!/usr/bin/env python3
"""Generate synthetic ArcherHub-shaped EAF PDF fixtures for Animo Sort tests.

All names, IDs, course codes, rooms, and fee values are fictitious. The real
DLSU EAF must never be used as a fixture or copied into this repository.

Column x-positions mirror the real ArcherHub EAF layout so parser tests
exercise realistic table geometry.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas as pdf_canvas

HERE = os.path.dirname(os.path.abspath(__file__))
GREEN = colors.HexColor("#087830")

PERIODS = [
    ("07:30", "AM", "09:00", "AM", 450, 540),
    ("09:15", "AM", "10:45", "AM", 555, 645),
    ("11:00", "AM", "12:30", "PM", 660, 750),
    ("12:45", "PM", "02:15", "PM", 765, 855),
    ("02:30", "PM", "04:00", "PM", 870, 960),
    ("04:15", "PM", "05:45", "PM", 975, 1065),
    ("06:00", "PM", "07:30", "PM", 1080, 1170),
    ("07:45", "PM", "09:15", "PM", 1185, 1275),
]

DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"]

# Real-EAF column x positions (points)
COL_NO = 79
COL_COURSE = 107
COL_TYPE = 255
COL_SECTION = 382
COL_CREDITS = 441
COL_SCHEDULE = 483

LINE_STEP = 10.8  # 0.15 inch wrapped-line step
ROW_STEP = 25.2  # 0.35 inch row step


@dataclass
class Course:
    code: str
    title: str
    ctype: str = "Lecture"
    section: str = "V01"
    credits: float = 3.0
    meetings: list[tuple[str, str, str]] = field(default_factory=list)
    # meetings: (day, time_string like "02:30 PM-04:00 PM", location)


def mt(start_h: str, start_ap: str, end_h: str, end_ap: str) -> str:
    return f"{start_h} {start_ap}-{end_h} {end_ap}"


def _wrap(c: pdf_canvas.Canvas, text: str, width: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = (current + " " + word).strip()
        if current and c.stringWidth(trial, "Helvetica", 9) > width:
            lines.append(current)
            current = word
        else:
            current = trial
    if current:
        lines.append(current)
    return lines or [""]


def render_eaf(
    path: str,
    student: str,
    sid: str,
    session: str,
    courses: list[Course],
    term: str = "Trimester 1",
    year: str = "Year 1",
) -> None:
    c = pdf_canvas.Canvas(path, pagesize=letter)
    width, height = letter
    margin = 0.6 * inch
    y = height - margin

    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(GREEN)
    c.drawString((width - c.stringWidth("ENROLLMENT ASSESSMENT FORM", "Helvetica-Bold", 14)) / 2, y, "ENROLLMENT ASSESSMENT FORM")
    y -= 0.35 * inch

    c.setFont("Helvetica", 9)
    c.setFillColor(colors.black)
    c.drawString(margin, y, f"STUDENT NAME             :    {student}")
    c.drawString(width / 2, y, f"STUDENT ID                   : {sid}")
    y -= 0.2 * inch
    c.drawString(margin, y, "PROGRAM                  :    BSA - Bachelor of Science in Accountancy")
    c.drawString(width / 2, y, f"ACADEMIC SESSION : {session}")
    y -= 0.2 * inch
    c.drawString(margin, y, f"TERM                     :    {term}")
    c.drawString(width / 2, y, "ENLISTMENT DATE : 07/15/2026 10:05 AM")
    y -= 0.2 * inch
    c.drawString(margin, y, f"YEAR LEVEL               :    {year}")
    y -= 0.35 * inch

    # Table header
    c.setFont("Helvetica-Bold", 9)
    c.drawString(COL_NO, y, "Sr.No")
    c.drawString(COL_COURSE, y, "Course")
    c.drawString(COL_TYPE, y, "Course Type")
    c.drawString(COL_SECTION, y, "Section")
    c.drawString(COL_CREDITS, y, "Credits")
    c.drawString(COL_SCHEDULE, y, "Day/Time/Room")
    y -= 0.08 * inch
    c.setLineWidth(0.5)
    c.line(margin, y, margin + 9.2 * inch, y)
    y -= 0.25 * inch

    c.setFont("Helvetica", 9)
    for i, course in enumerate(courses, start=1):
        row_bottom = _draw_schedule_row(c, y, i, course)
        y = row_bottom

    y -= 0.25 * inch
    # Payments section (fictitious values)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(margin, y, "Payments                     Amounts")
    y -= 0.18 * inch
    c.setFont("Helvetica", 9)
    rows = [
        ("Tuition Fee", "61,500.00"),
        ("Miscellaneous Fees", "9,800.00"),
        ("Special Fees", "150.00"),
        ("Total Fees", "71,450.00"),
        ("Less payment", "-0.00"),
        ("Scholarship+Discount", "-0.00"),
        ("Balance", "71,450.00"),
    ]
    for label, amt in rows:
        c.drawString(margin, y, label)
        c.drawString(margin + 2.5 * inch, y, amt)
        y -= 0.18 * inch

    y -= 0.2 * inch
    c.setFont("Helvetica", 8)
    c.drawString(margin, y, "In consideration of my admission to De La Salle University, I hereby comply and pledge to fully settle my accounts on the schedule stipulated by this institution which I am enrolled.")
    c.save()


def _draw_schedule_row(c: pdf_canvas.Canvas, y: float, no: int, course: Course) -> float:
    c.setFont("Helvetica", 9)
    c.drawString(COL_NO, y, str(no))

    course_text = f"{course.code}-{course.title}"
    course_lines = _wrap(c, course_text, 2.6 * inch)
    for i, line in enumerate(course_lines):
        c.drawString(COL_COURSE, y - i * LINE_STEP, line)

    c.drawString(COL_TYPE, y, course.ctype)
    c.drawString(COL_SECTION, y, course.section)
    c.drawString(COL_CREDITS, y, f"{course.credits:.2f}")

    seg_text = ", ".join(f"{d} | {t} | {loc}" for d, t, loc in course.meetings)
    seg_lines = _wrap(c, seg_text, 1.7 * inch)  # column is ~129pt wide to the page edge
    for i, line in enumerate(seg_lines):
        c.drawString(COL_SCHEDULE, y - i * LINE_STEP, line)

    lines = max(len(course_lines), len(seg_lines), 1)
    return y - lines * LINE_STEP - (ROW_STEP - LINE_STEP)


def fixture(name: str, courses: list[Course], **kw) -> str:
    out = os.path.join(HERE, name)
    render_eaf(
        out,
        kw.get("student", "DELA CRUZ, JUAN PEDRO"),
        kw.get("sid", "11876543"),
        kw.get("session", "AY 2026-2027 Term 1"),
        courses,
        kw.get("term", "Trimester 1"),
        kw.get("year", "Year 1"),
    )
    return out


def course(code: str, title: str, meetings: list[tuple[str, str, str]], section: str = "V01", credits: float = 3.0) -> Course:
    return Course(code=code, title=title, meetings=meetings, section=section, credits=credits)


def _eaf_page_header(c: pdf_canvas.Canvas, session: str = "AY 2026-2027 Term 1") -> float:
    width, height = letter
    margin = 0.6 * inch
    y = height - margin
    c.setFont("Helvetica-Bold", 14)
    c.drawString((width - c.stringWidth("ENROLLMENT ASSESSMENT FORM", "Helvetica-Bold", 14)) / 2, y, "ENROLLMENT ASSESSMENT FORM")
    y -= 0.35 * inch
    c.setFont("Helvetica", 9)
    c.drawString(margin, y, f"ACADEMIC SESSION : {session}")
    y -= 0.55 * inch
    c.setFont("Helvetica-Bold", 9)
    c.drawString(COL_NO, y, "Sr.No")
    c.drawString(COL_COURSE, y, "Course")
    c.drawString(COL_TYPE, y, "Course Type")
    c.drawString(COL_SECTION, y, "Section")
    c.drawString(COL_CREDITS, y, "Credits")
    c.drawString(COL_SCHEDULE, y, "Day/Time/Room")
    y -= 0.25 * inch
    return y


def _draw_manual_row(c: pdf_canvas.Canvas, y: float, no: int, course_text: str, section: str, credits: str, schedule: str) -> float:
    c.setFont("Helvetica", 9)
    c.drawString(COL_NO, y, str(no))
    course_lines = _wrap(c, course_text, 2.6 * inch)
    for i, line in enumerate(course_lines):
        c.drawString(COL_COURSE, y - i * LINE_STEP, line)
    c.drawString(COL_TYPE, y, "Lecture")
    c.drawString(COL_SECTION, y, section)
    c.drawString(COL_CREDITS, y, credits)
    seg_lines = _wrap(c, schedule, 1.7 * inch)
    for i, line in enumerate(seg_lines):
        c.drawString(COL_SCHEDULE, y - i * LINE_STEP, line)
    return y - max(len(course_lines), len(seg_lines), 1) * LINE_STEP - (ROW_STEP - LINE_STEP)


def main() -> None:
    os.makedirs(HERE, exist_ok=True)

    courses7 = [
        course("FINA101", "ADVANCED FINANCIAL ECONOMETRICS", [("MON", mt("02:30", "PM", "04:00", "PM"), "M306"), ("THU", mt("02:30", "PM", "04:00", "PM"), "Online")]),
        course("ECON210", "ECONOMICS OF INFORMATION", [("MON", mt("11:00", "AM", "12:30", "PM"), "V305"), ("THU", mt("11:00", "AM", "12:30", "PM"), "Online")]),
        course("PHLO201", "THE FILIPINO AND ASEAN", [("MON", mt("07:30", "AM", "09:00", "AM"), "Online"), ("THU", mt("07:30", "AM", "09:00", "AM"), "Online")], section="Z14"),
        course("CSIT110", "INTRODUCTION TO MACHINE LEARNING", [("TUE", mt("09:15", "AM", "10:45", "AM"), "Online"), ("FRI", mt("09:15", "AM", "10:45", "AM"), "Online")], section="S04"),
        course("BANK305", "INVESTMENT BANKING", [("TUE", mt("06:00", "PM", "07:30", "PM"), "L310"), ("FRI", mt("06:00", "PM", "07:30", "PM"), "Online")], section="C01"),
        course("FINR420", "SPECIAL TOPICS IN FINANCE", [("TUE", mt("04:15", "PM", "05:45", "PM"), "G102"), ("FRI", mt("04:15", "PM", "05:45", "PM"), "Online")], section="C05"),
        course("SOCI230", "SCIENCE, TECHNOLOGY, AND THE SOCIETY", [("TUE", mt("02:30", "PM", "04:00", "PM"), "Online"), ("FRI", mt("02:30", "PM", "04:00", "PM"), "Online")], section="Y12"),
    ]
    fixture("valid-seven.pdf", courses7)

    fixture("one-course.pdf", [course("ACCT101", "FUNDAMENTALS OF ACCOUNTING", [("WED", mt("09:15", "AM", "10:45", "AM"), "R101")])])

    fixture("variable-meetings.pdf", [course("MATH201", "CALCULUS I", [("MON", mt("09:15", "AM", "10:45", "AM"), "M201"), ("WED", mt("09:15", "AM", "10:45", "AM"), "M201"), ("FRI", mt("09:15", "AM", "10:45", "AM"), "Online")])])

    six_day = [course("STAT101", "INTRODUCTION TO STATISTICS", [(d, mt("11:00", "AM", "12:30", "PM"), "Online" if d in ("MON", "WED", "FRI") else "L102") for d in DAYS])]
    fixture("six-day.pdf", six_day)

    eight_rows = [course(f"PERD{i:02d}", f"PERIOD TEST COURSE {i}", [(DAYS[i % 6], mt(p[0], p[1], p[2], p[3]), "Online")], section=f"S{i}") for i, p in enumerate(PERIODS)]
    fixture("eight-periods.pdf", eight_rows)

    fixture("custom-interval.pdf", [course("MKTG301", "BRAND MANAGEMENT", [("WED", mt("10:50", "AM", "12:20", "PM"), "R305")])])

    fixture("room-online.pdf", [course("FIN401", "CORPORATE FINANCE", [("MON", mt("04:15", "PM", "05:45", "PM"), "G204"), ("THU", mt("04:15", "PM", "05:45", "PM"), "Online")])])

    fixture("long-title.pdf", [course("PHLCOMA", "PHILOSOPHY OF THE HUMAN PERSON IN THE CONTEMPORARY WORLD AND ITS APPLICATIONS", [("TUE", mt("07:45", "PM", "09:15", "PM"), "V210")])])

    fixture("identity-payment.pdf", courses7)

    non_eaf = os.path.join(HERE, "non-eaf.pdf")
    c = pdf_canvas.Canvas(non_eaf, pagesize=letter)
    c.setFont("Helvetica", 12)
    c.drawString(1 * inch, 10 * inch, "This is a plain document about gardening tips.")
    c.drawString(1 * inch, 9.5 * inch, "It contains no enrollment assessment form at all.")
    c.save()

    no_schedule = os.path.join(HERE, "eaf-no-schedule.pdf")
    c = pdf_canvas.Canvas(no_schedule, pagesize=letter)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(2 * inch, 10 * inch, "ENROLLMENT ASSESSMENT FORM")
    c.setFont("Helvetica", 10)
    c.drawString(1 * inch, 9 * inch, "ACADEMIC SESSION : AY 2026-2027 Term 1")
    c.drawString(1 * inch, 8.5 * inch, "This document is missing the schedule table entirely.")
    c.save()

    missing_time = os.path.join(HERE, "missing-time.pdf")
    c = pdf_canvas.Canvas(missing_time, pagesize=letter)
    y = _eaf_page_header(c)
    _draw_manual_row(c, y, 1, "HIST101-WORLD HISTORY", "A01", "3.00", "MON | M101")
    c.save()

    unsupported_day = os.path.join(HERE, "unsupported-day.pdf")
    c = pdf_canvas.Canvas(unsupported_day, pagesize=letter)
    y = _eaf_page_header(c)
    _draw_manual_row(c, y, 1, "MUS101-INTRODUCTION TO MUSIC", "A01", "3.00", "SUN | 09:15 AM-10:45 AM | Online")
    c.save()

    invalid_interval = os.path.join(HERE, "invalid-interval.pdf")
    c = pdf_canvas.Canvas(invalid_interval, pagesize=letter)
    y = _eaf_page_header(c)
    _draw_manual_row(c, y, 1, "ENG101-COMMUNICATION ARTS", "A01", "3.00", "MON | 04:00 PM-02:30 PM | M101")
    c.save()

    touching = os.path.join(HERE, "touching-intervals.pdf")
    c = pdf_canvas.Canvas(touching, pagesize=letter)
    y = _eaf_page_header(c)
    y = _draw_manual_row(c, y, 1, "ECON101-MICROECONOMICS", "A01", "3.00", "MON | 09:15 AM-10:45 AM | M101")
    _draw_manual_row(c, y, 2, "ECON102-MACROECONOMICS", "A02", "3.00", "MON | 10:45 AM-12:15 PM | M102")
    c.save()

    overlap = os.path.join(HERE, "overlap.pdf")
    c = pdf_canvas.Canvas(overlap, pagesize=letter)
    y = _eaf_page_header(c)
    y = _draw_manual_row(c, y, 1, "FIN101-FINANCIAL MARKETS", "A01", "3.00", "MON | 09:15 AM-10:45 AM | M101")
    _draw_manual_row(c, y, 2, "FIN102-INTERNATIONAL FINANCE", "A02", "3.00", "MON | 10:15 AM-11:45 AM | M102")
    c.save()

    multi_page = os.path.join(HERE, "multi-page.pdf")
    c = pdf_canvas.Canvas(multi_page, pagesize=letter)
    y = _eaf_page_header(c)
    y = _draw_manual_row(c, y, 1, "CHEM101-GENERAL CHEMISTRY", "A01", "3.00", "MON | 09:15 AM-10:45 AM | S101")
    c.showPage()
    y = _eaf_page_header(c)
    _draw_manual_row(c, y, 2, "PHYS101-GENERAL PHYSICS", "A02", "3.00", "WED | 11:00 AM-12:30 PM | S102")
    c.save()

    pdfs = [f for f in os.listdir(HERE) if f.endswith(".pdf")]
    print(f"Generated {len(pdfs)} fixture files in {HERE}")


if __name__ == "__main__":
    main()
