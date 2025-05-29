#!/usr/bin/env python3
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import sys

def create_test_pdf(filename, num_pages=3):
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter
    
    for page_num in range(1, num_pages + 1):
        # Add text content for each page
        c.setFont("Helvetica", 16)
        c.drawString(100, height - 100, f"Test Document - Page {page_num}")
        
        c.setFont("Helvetica", 12)
        y_position = height - 150
        
        if page_num == 1:
            content = [
                "Medical Records Summary",
                "Patient: John Doe",
                "Date of Visit: 2024-01-15",
                "Chief Complaint: Annual checkup",
                "Vital Signs:",
                "  Blood Pressure: 120/80 mmHg",
                "  Temperature: 98.6°F",
                "  Heart Rate: 72 bpm"
            ]
        elif page_num == 2:
            content = [
                "Examination Results",
                "Physical Examination:",
                "  General appearance: Well-developed",
                "  HEENT: Normal",
                "  Cardiovascular: Regular rhythm",
                "  Respiratory: Clear to auscultation",
                "  Abdomen: Soft, non-tender",
                "Laboratory Results:",
                "  Complete Blood Count: Within normal limits"
            ]
        else:  # page 3
            content = [
                "Treatment Plan",
                "Recommendations:",
                "  Continue current medications",
                "  Follow up in 6 months",
                "  Annual screening labs",
                "Medications:",
                "  Lisinopril 10mg daily",
                "  Metformin 500mg twice daily",
                "Provider: Dr. Smith, MD"
            ]
        
        for line in content:
            c.drawString(100, y_position, line)
            y_position -= 20
        
        c.showPage()
    
    c.save()
    print(f"Created {num_pages}-page PDF: {filename}")

if __name__ == "__main__":
    filename = sys.argv[1] if len(sys.argv) > 1 else "uploads/test_3page.pdf"
    pages = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    create_test_pdf(filename, pages)
