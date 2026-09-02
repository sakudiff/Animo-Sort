import os

from reportlab.lib.pagesizes import landscape, letter
from reportlab.pdfgen import canvas


SESSION = "AY 2026-2027 Term 1"
OUTPUT = "tests/fixtures/comprehensive-eaf/comprehensive-eaf.pdf"
os.environ.setdefault("SOURCE_DATE_EPOCH", "946684800")

ROWS = [
    {
        "code": "PAIR101",
        "title": "MON THU PAIR",
        "section": "P01",
        "credits": "3.00",
        "course_type": "Lecture",
        "schedule": "MON | 07:30 AM - 09:00 AM | L101 THU | 07:30 AM - 09:00 AM | L101",
    },
    {
        "code": "PAIR102",
        "title": "TUE FRI PAIR",
        "section": "P02",
        "credits": "3.00",
        "course_type": "Lecture",
        "schedule": "TUE | 09:15 AM - 10:45 AM | M101 FRI | 09:15 AM - 10:45 AM | M101",
    },
    {
        "code": "PAIR103",
        "title": "WED SAT PAIR",
        "section": "P03",
        "credits": "3.00",
        "course_type": "Lecture",
        "schedule": "WED | 11:00 AM - 12:30 PM | AG101 SAT | 11:00 AM - 12:30 PM | AG101",
    },
    {
        "code": "PE101",
        "title": "PE SINGLE DAY",
        "section": "PE1",
        "credits": "2.00",
        "course_type": "PE",
        "schedule": "MON | 01:00 PM - 02:00 PM | ER101",
    },
    {
        "code": "LAB101",
        "title": "LAB SINGLE DAY",
        "section": "LB1",
        "credits": "1.00",
        "course_type": "Laboratory",
        "schedule": "TUE | 02:15 PM - 04:15 PM | V101",
    },
    {
        "code": "ONLINE101",
        "title": "FULL ONLINE",
        "section": "ON1",
        "credits": "3.00",
        "course_type": "Lecture",
        "schedule": "MON | 05:00 PM - 06:00 PM | Online THU | 05:00 PM - 06:00 PM | Online",
    },
    {
        "code": "HYBRID101",
        "title": "HYBRID ONLINE F2F",
        "section": "HY1",
        "credits": "3.00",
        "course_type": "Lecture",
        "schedule": "TUE | 07:30 PM - 08:30 PM | Online FRI | 07:30 PM - 08:30 PM | M201",
    },
    {
        "code": "FACESAME1",
        "title": "FACE SAME ROOM",
        "section": "FF1",
        "credits": "3.00",
        "course_type": "Lecture",
        "schedule": "WED | 01:00 PM - 02:30 PM | B101 SAT | 01:00 PM - 02:30 PM | B101",
    },
    {
        "code": "FACEDIFF1",
        "title": "FACE DIFF ROOM",
        "section": "FF2",
        "credits": "3.00",
        "course_type": "Lecture",
        "schedule": "MON | 03:00 PM - 04:30 PM | L201 THU | 03:00 PM - 04:30 PM | L202",
    },
    {
        "code": "VAR101",
        "title": "DAY TIME ROOM",
        "section": "VR1",
        "credits": "3.00",
        "course_type": "Lecture",
        "schedule": "TUE | 05:00 PM - 06:30 PM | AG201 FRI | 11:00 AM - 12:30 PM | G201",
    },
    {
        "code": "LATE101",
        "title": "LATE EVENING",
        "section": "LT1",
        "credits": "3.00",
        "course_type": "Lecture",
        "schedule": "WED | 09:00 PM - 10:30 PM | V201 SAT | 09:00 PM - 10:30 PM | V201",
    },
    {
        "code": "NSTP101",
        "title": "NSTP ASYNC",
        "section": "N101",
        "credits": "3.00",
        "course_type": "NSTP",
        "schedule": "NO TIME, NO VENUE, JUST ASYNC",
    },
    {
        "code": "NSTPCW1",
        "title": "CWTS PART 1",
        "section": "CW1",
        "credits": "3.00",
        "course_type": "NSTP",
        "schedule": "MON | 06:30 AM - 07:15 AM | Online THU | 06:30 AM - 07:15 AM | Online",
    },
    {
        "code": "NSTPCW2",
        "title": "CWTS PART 2",
        "section": "CW2",
        "credits": "3.00",
        "course_type": "NSTP",
        "schedule": "TUE | 06:30 AM - 07:15 AM | Online FRI | 06:30 AM - 07:15 AM | Online",
    },
    {
        "code": "NSTPLT1",
        "title": "LTS PART 1",
        "section": "LT2",
        "credits": "3.00",
        "course_type": "NSTP",
        "schedule": "WED | 06:30 PM - 07:30 PM | Online SAT | 06:30 PM - 07:30 PM | Online",
    },
    {
        "code": "NSTPLT2",
        "title": "LTS PART 2",
        "section": "LT3",
        "credits": "3.00",
        "course_type": "NSTP",
        "schedule": "WED | 08:00 PM - 09:00 PM | Online SAT | 08:00 PM - 09:00 PM | Online",
    },
    {
        "code": "NSTPRO1",
        "title": "ROTC PART 1",
        "section": "RO1",
        "credits": "3.00",
        "course_type": "NSTP",
        "schedule": "TUE | 01:00 PM - 01:45 PM | AG301 FRI | 01:00 PM - 01:45 PM | AG302",
    },
    {
        "code": "NSTPRO2",
        "title": "ROTC PART 2",
        "section": "RO2",
        "credits": "3.00",
        "course_type": "NSTP",
        "schedule": "TUE | 12:00 PM - 12:45 PM | AG303 FRI | 02:00 PM - 02:45 PM | AG304",
    },
    {
        "code": "LAGMM1",
        "title": "LAGUNA MM",
        "section": "MM1",
        "credits": "1.00",
        "course_type": "Lecture",
        "schedule": "MON | 10:00 AM - 10:30 AM | MM101",
    },
    {
        "code": "LAGBOX1",
        "title": "LAGUNA MM BOX",
        "section": "MB1",
        "credits": "1.00",
        "course_type": "Lecture",
        "schedule": "TUE | 11:00 AM - 11:30 AM | MM-BLACKBOX",
    },
    {
        "code": "LAGMRR1",
        "title": "LAGUNA MRR",
        "section": "MR1",
        "credits": "1.00",
        "course_type": "Lecture",
        "schedule": "WED | 09:00 AM - 09:30 AM | MRR101",
    },
    {
        "code": "LAGUH1",
        "title": "LAGUNA UH",
        "section": "UH1",
        "credits": "1.00",
        "course_type": "Lecture",
        "schedule": "THU | 10:00 AM - 10:30 AM | UH208",
    },
    {
        "code": "LAGEKR1",
        "title": "LAGUNA EKR",
        "section": "EK1",
        "credits": "1.00",
        "course_type": "Lecture",
        "schedule": "FRI | 08:00 AM - 08:30 AM | EKR101",
    },
    {
        "code": "LAGRL1",
        "title": "LAGUNA RL",
        "section": "RL1",
        "credits": "1.00",
        "course_type": "Lecture",
        "schedule": "SAT | 03:00 PM - 03:30 PM | RL101",
    },
    {
        "code": "LAGLC1",
        "title": "LAGUNA LC1",
        "section": "LC1",
        "credits": "1.00",
        "course_type": "Lecture",
        "schedule": "MON | 10:30 AM - 11:00 AM | LC1",
    },
    {
        "code": "LAGLC2",
        "title": "LAGUNA LC2",
        "section": "LC2",
        "credits": "1.00",
        "course_type": "Lecture",
        "schedule": "TUE | 11:30 AM - 12:00 PM | LC2",
    },
]


def draw_page(pdf, page_rows, page_number, page_width, page_height):
    pdf.setTitle("Synthetic AnimoSort comprehensive EAF")
    pdf.setAuthor("AnimoSort test fixture")
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(42, page_height - 42, "ENROLLMENT ASSESSMENT FORM")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(42, page_height - 60, f"ACADEMIC SESSION: {SESSION}")

    header_y = page_height - 100
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(245, header_y, "Course Type")
    pdf.drawString(337, header_y, "Section")
    pdf.drawString(398, header_y, "Credits")
    pdf.drawString(441, header_y, "Day/Time/Room")

    pdf.setFont("Helvetica", 7.25)
    row_y = header_y - 24
    for number, row in enumerate(page_rows, start=(page_number - 1) * 10 + 1):
        pdf.drawString(20, row_y, str(number))
        pdf.drawString(110, row_y, f"{row['code']}-{row['title']}")
        pdf.drawString(230, row_y, row["course_type"])
        pdf.drawString(310, row_y, row["section"])
        pdf.drawString(380, row_y, row["credits"])
        pdf.drawString(450, row_y, row["schedule"])
        row_y -= 24

    pdf.setFont("Helvetica-Oblique", 7)
    pdf.drawString(42, 24, f"Synthetic fixture - fake data only - page {page_number}")
    pdf.showPage()


def main():
    page_width, page_height = landscape(letter)
    pdf = canvas.Canvas(OUTPUT, pagesize=(page_width, page_height))
    for page_number, start in enumerate(range(0, len(ROWS), 10), start=1):
        draw_page(pdf, ROWS[start:start + 10], page_number, page_width, page_height)
    pdf.save()


if __name__ == "__main__":
    main()
