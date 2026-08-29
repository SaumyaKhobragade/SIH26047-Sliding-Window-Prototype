"""
Renders a printed prescription image for the OCR test in test_flow.py.

This is test INPUT, not test data: it stands in for the photo a patient would
take at the kiosk, so that the OCR → extraction → drug-match → lab-flag chain
can be exercised against something a real reader has to actually read. Nothing
it contains is ever presented as a patient's record — the assertions check that
the pipeline recovered what is on the page, and a failure means the pipeline is
broken, not that the page was wrong.

Its one honest limitation: this is clean 30px printed text. Passing here says
the plumbing works. It says nothing about handwriting, which is the harder and
more common real case and can only be judged on real photographs.
"""
from typing import Optional

LINES_RX = [
    "1.  Tab. Metformin 500 mg          1-0-1  after food     x 30 days",
    "2.  Tab. Amlodipine 5 mg           1-0-0  morning        x 30 days",
    "3.  Tab. Atorvastatin 10 mg        0-0-1  at bedtime     x 30 days",
    "4.  Cap. Vitamin D3 60000 IU       once weekly           x 8 weeks",
]
LINES_LABS = [
    "HbA1c            8.1 %          (ref 4.0 - 5.6)",
    "Fasting Glucose  148 mg/dL      (ref 70 - 100)",
    "LDL Cholesterol  162 mg/dL      (ref < 100)",
    "Serum Creatinine 1.0 mg/dL      (ref 0.7 - 1.3)",
    "Haemoglobin      13.4 g/dL      (ref 13.0 - 17.0)",
]

# What the pipeline must recover from the page above.
EXPECT_DRUGS = ["Metformin", "Amlodipine", "Atorvastatin", "Vitamin D3"]
EXPECT_ABNORMAL = ["hba1c", "glucose", "ldl"]
EXPECT_NORMAL = ["creatinine", "haemoglobin"]
EXPECT_DOCTOR = "Anjali Deshmukh"
EXPECT_DATE = "2026-08-14"
EXPECT_DIAGNOSIS = "diabetes"


def _font(size: int, bold: bool = False):
    from PIL import ImageFont
    candidates = (
        ["arialbd.ttf", "C:/Windows/Fonts/arialbd.ttf", "DejaVuSans-Bold.ttf"] if bold
        else ["arial.ttf", "C:/Windows/Fonts/arial.ttf", "DejaVuSans.ttf"]
    )
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return None  # no scalable font — caller skips, load_default is too small to OCR


def render_prescription_png() -> Optional[bytes]:
    """
    Return PNG bytes of a printed prescription, or None if this machine cannot
    render one (no Pillow, or no TrueType font — the bundled bitmap default is
    far too small for OCR, and a pass on it would mean nothing).
    """
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return None

    if _font(30) is None:
        return None

    import io

    W, H = 1240, 1754
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)

    y = 70
    d.text((70, y), "SHRI RAM MULTISPECIALITY CLINIC", font=_font(44, True), fill="black")
    y += 62
    d.text((70, y), "Dr. Anjali Deshmukh, MBBS, MD (Medicine)", font=_font(30), fill="black")
    y += 44
    d.text((70, y), "Reg. No. MH/2011/45210   |   Ph: 020-2555 1188", font=_font(26), fill="black")
    y += 50
    d.line([(70, y), (W - 70, y)], fill="black", width=3)
    y += 40
    d.text((70, y), "Patient: Ramesh Kumar", font=_font(30), fill="black")
    d.text((820, y), "Date: 14/08/2026", font=_font(30), fill="black")
    y += 44
    d.text((70, y), "Age / Sex: 58 yrs / Male", font=_font(30), fill="black")
    y += 60
    d.text((70, y), "Diagnosis: Type 2 Diabetes Mellitus with Hypertension",
           font=_font(31, True), fill="black")
    y += 70
    d.text((70, y), "Rx", font=_font(52, True), fill="black")
    y += 76
    for line in LINES_RX:
        d.text((90, y), line, font=_font(30), fill="black")
        y += 52
    y += 30
    d.text((70, y), "Investigations reviewed:", font=_font(31, True), fill="black")
    y += 56
    for line in LINES_LABS:
        d.text((90, y), line, font=_font(29), fill="black")
        y += 50
    y += 40
    d.text((70, y), "Advice: Low salt, low sugar diet. 30 min brisk walk daily.",
           font=_font(29), fill="black")
    y += 46
    d.text((70, y), "Review after 4 weeks with repeat HbA1c.", font=_font(29), fill="black")
    y += 90
    d.text((820, y), "Dr. Anjali Deshmukh", font=_font(30, True), fill="black")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


if __name__ == "__main__":
    data = render_prescription_png()
    if data is None:
        print("Cannot render — Pillow or a TrueType font is missing.")
    else:
        with open("printed_rx_fixture.png", "wb") as f:
            f.write(data)
        print(f"wrote printed_rx_fixture.png ({len(data)} bytes)")
