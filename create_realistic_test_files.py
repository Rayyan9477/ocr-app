#!/usr/bin/env python3
"""
Create realistic test files with actual content for OCR testing
"""

import os
import sys
from PIL import Image, ImageDraw, ImageFont
import textwrap

def create_realistic_medical_bill(output_path):
    """Create a realistic medical bill image"""
    img = Image.new('RGB', (850, 1100), color='white')
    draw = ImageDraw.Draw(img)
    
    # Try to use a professional font
    try:
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
        header_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
        body_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
        small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except:
        title_font = ImageFont.load_default()
        header_font = ImageFont.load_default()
        body_font = ImageFont.load_default()
        small_font = ImageFont.load_default()
    
    y = 50
    
    # Header
    draw.text((300, y), "CITYWIDE MEDICAL CENTER", fill='black', font=title_font)
    y += 40
    draw.text((320, y), "123 Healthcare Drive", fill='black', font=body_font)
    y += 25
    draw.text((310, y), "Medical City, MC 12345", fill='black', font=body_font)
    y += 25
    draw.text((340, y), "Phone: (555) 123-4567", fill='black', font=body_font)
    y += 50
    
    # Draw a line
    draw.line([(50, y), (800, y)], fill='black', width=2)
    y += 30
    
    # Bill header
    draw.text((350, y), "MEDICAL BILL", fill='black', font=title_font)
    y += 50
    
    # Patient information
    draw.text((50, y), "PATIENT INFORMATION:", fill='black', font=header_font)
    y += 30
    draw.text((50, y), "Patient Name: Sarah Johnson", fill='black', font=body_font)
    y += 25
    draw.text((50, y), "Patient ID: MED-789456", fill='black', font=body_font)
    y += 25
    draw.text((50, y), "Date of Birth: March 15, 1985", fill='black', font=body_font)
    y += 25
    draw.text((50, y), "Address: 456 Oak Street, Hometown, HT 67890", fill='black', font=body_font)
    y += 40
    
    # Service information
    draw.text((50, y), "SERVICE DETAILS:", fill='black', font=header_font)
    y += 30
    draw.text((50, y), "Date of Service: June 08, 2025", fill='black', font=body_font)
    y += 25
    draw.text((50, y), "Provider: Dr. Michael Rodriguez, MD", fill='black', font=body_font)
    y += 25
    draw.text((50, y), "Department: Internal Medicine", fill='black', font=body_font)
    y += 40
    
    # Services table header
    draw.text((50, y), "SERVICES PROVIDED:", fill='black', font=header_font)
    y += 30
    
    # Table headers
    draw.line([(50, y), (800, y)], fill='black', width=1)
    y += 10
    draw.text((60, y), "Description", fill='black', font=body_font)
    draw.text((400, y), "CPT Code", fill='black', font=body_font)
    draw.text((550, y), "Quantity", fill='black', font=body_font)
    draw.text((650, y), "Amount", fill='black', font=body_font)
    y += 25
    draw.line([(50, y), (800, y)], fill='black', width=1)
    y += 15
    
    # Service items
    services = [
        ("Office Visit - Established Patient", "99213", "1", "$185.00"),
        ("Blood Pressure Check", "99000", "1", "$25.00"),
        ("Laboratory - Complete Blood Count", "85025", "1", "$45.00"),
        ("Laboratory - Basic Metabolic Panel", "80048", "1", "$65.00"),
        ("EKG - 12 Lead", "93000", "1", "$75.00")
    ]
    
    for service, code, qty, amount in services:
        draw.text((60, y), service, fill='black', font=body_font)
        draw.text((420, y), code, fill='black', font=body_font)
        draw.text((570, y), qty, fill='black', font=body_font)
        draw.text((660, y), amount, fill='black', font=body_font)
        y += 25
    
    draw.line([(50, y), (800, y)], fill='black', width=1)
    y += 20
    
    # Totals
    draw.text((500, y), "Subtotal:", fill='black', font=header_font)
    draw.text((660, y), "$395.00", fill='black', font=header_font)
    y += 25
    draw.text((500, y), "Insurance Payment:", fill='black', font=body_font)
    draw.text((660, y), "-$315.00", fill='black', font=body_font)
    y += 25
    draw.text((500, y), "Patient Responsibility:", fill='black', font=header_font)
    draw.text((660, y), "$80.00", fill='black', font=header_font)
    y += 40
    
    # Payment information
    draw.text((50, y), "PAYMENT INFORMATION:", fill='black', font=header_font)
    y += 30
    draw.text((50, y), "Insurance: Blue Cross Blue Shield", fill='black', font=body_font)
    y += 25
    draw.text((50, y), "Policy Number: BCB123456789", fill='black', font=body_font)
    y += 25
    draw.text((50, y), "Claim Number: CLM-2025-0608-001", fill='black', font=body_font)
    y += 40
    
    # Footer
    draw.text((50, y), "Payment due within 30 days. Questions? Call (555) 123-4567", fill='black', font=small_font)
    y += 20
    draw.text((50, y), "Thank you for choosing Citywide Medical Center", fill='black', font=small_font)
    
    img.save(output_path, 'PNG', quality=95)
    print(f"Created realistic medical bill: {output_path}")

def create_research_paper_excerpt(output_path):
    """Create a research paper excerpt"""
    img = Image.new('RGB', (850, 1100), color='white')
    draw = ImageDraw.Draw(img)
    
    try:
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
        header_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
        body_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except:
        title_font = header_font = body_font = ImageFont.load_default()
    
    y = 50
    
    # Title
    title_text = "Machine Learning Approaches to Medical Document Processing"
    draw.text((100, y), title_text, fill='black', font=title_font)
    y += 40
    
    # Authors
    draw.text((250, y), "Dr. Emily Chen¹, Prof. James Wilson²", fill='black', font=header_font)
    y += 25
    draw.text((180, y), "¹Stanford University, ²Massachusetts Institute of Technology", fill='black', font=body_font)
    y += 50
    
    # Abstract
    draw.text((50, y), "ABSTRACT", fill='black', font=header_font)
    y += 30
    
    abstract_text = """
    This paper presents a comprehensive analysis of machine learning techniques 
    applied to medical document processing. We evaluate the performance of various 
    optical character recognition (OCR) systems on medical bills, prescriptions, 
    and clinical notes. Our findings demonstrate that ensemble methods combining 
    multiple OCR engines achieve 94.7% accuracy on handwritten medical documents, 
    representing a 12% improvement over single-engine approaches.
    
    Keywords: Machine Learning, OCR, Medical Documents, Document Processing
    """
    
    wrapped_abstract = textwrap.fill(abstract_text.strip(), width=95)
    for line in wrapped_abstract.split('\n'):
        draw.text((50, y), line, fill='black', font=body_font)
        y += 18
    
    y += 30
    
    # Introduction
    draw.text((50, y), "1. INTRODUCTION", fill='black', font=header_font)
    y += 30
    
    intro_text = """
    Medical document processing has emerged as a critical application area for 
    artificial intelligence systems. Healthcare institutions process millions of 
    documents annually, including patient records, insurance claims, prescriptions, 
    and diagnostic reports. The accuracy of document digitization directly impacts 
    patient care quality and administrative efficiency.
    
    Traditional OCR systems face significant challenges when processing medical 
    documents due to several factors: (1) varied handwriting styles from healthcare 
    professionals, (2) specialized medical terminology, (3) document degradation 
    from scanning and photocopying, and (4) complex layouts mixing printed and 
    handwritten content.
    
    Recent advances in deep learning have opened new possibilities for addressing 
    these challenges. Convolutional neural networks (CNNs) and transformer 
    architectures have shown remarkable performance in image recognition and 
    natural language processing tasks.
    """
    
    wrapped_intro = textwrap.fill(intro_text.strip(), width=95)
    for line in wrapped_intro.split('\n'):
        draw.text((50, y), line, fill='black', font=body_font)
        y += 18
    
    y += 30
    
    # Methods section
    draw.text((50, y), "2. METHODOLOGY", fill='black', font=header_font)
    y += 30
    
    methods_text = """
    2.1 Dataset Preparation
    
    We compiled a dataset of 10,000 medical documents from three major healthcare 
    systems. The dataset includes:
    • 3,500 medical bills and insurance claims
    • 2,800 handwritten clinical notes
    • 2,200 prescription forms
    • 1,500 diagnostic reports
    
    All documents were anonymized and manually transcribed by certified medical 
    transcriptionists to create ground truth labels.
    
    2.2 OCR Engine Evaluation
    
    We evaluated five state-of-the-art OCR systems:
    - Tesseract 5.0 with LSTM models
    - Google Cloud Vision API
    - Amazon Textract
    - Microsoft Azure Cognitive Services
    - Custom CNN-based architecture
    """
    
    wrapped_methods = textwrap.fill(methods_text.strip(), width=95)
    for line in wrapped_methods.split('\n'):
        draw.text((50, y), line, fill='black', font=body_font)
        y += 18
    
    # Page number
    draw.text((400, 1050), "Page 1", fill='black', font=body_font)
    
    img.save(output_path, 'PNG', quality=95)
    print(f"Created research paper excerpt: {output_path}")

def create_handwritten_note(output_path):
    """Create a simulated handwritten medical note"""
    img = Image.new('RGB', (850, 1100), color='white')
    draw = ImageDraw.Draw(img)
    
    try:
        # Use a font that looks more handwritten
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
    except:
        font = small_font = ImageFont.load_default()
    
    y = 80
    
    # Header
    draw.text((50, 30), "PATIENT PROGRESS NOTES", fill='black', font=font)
    draw.line([(50, 60), (800, 60)], fill='black', width=1)
    
    # Date and patient info
    draw.text((50, y), "Date: June 12, 2025", fill='black', font=font)
    draw.text((500, y), "Time: 2:30 PM", fill='black', font=font)
    y += 35
    
    draw.text((50, y), "Patient: Maria Garcia", fill='black', font=font)
    draw.text((500, y), "Age: 42", fill='black', font=font)
    y += 35
    
    draw.text((50, y), "Chief Complaint:", fill='black', font=font)
    y += 25
    draw.text((70, y), "Patient reports persistent headaches for 3 days", fill='black', font=font)
    y += 25
    draw.text((70, y), "accompanied by mild nausea and sensitivity to light", fill='black', font=font)
    y += 40
    
    # Vital signs
    draw.text((50, y), "Vital Signs:", fill='black', font=font)
    y += 25
    draw.text((70, y), "BP: 128/82 mmHg", fill='black', font=font)
    draw.text((300, y), "Pulse: 76 bpm", fill='black', font=font)
    draw.text((500, y), "Temp: 98.9°F", fill='black', font=font)
    y += 25
    draw.text((70, y), "Resp: 18/min", fill='black', font=font)
    draw.text((300, y), "O2 Sat: 98%", fill='black', font=font)
    y += 40
    
    # Physical exam
    draw.text((50, y), "Physical Examination:", fill='black', font=font)
    y += 25
    draw.text((70, y), "General: Alert and oriented x3, appears uncomfortable", fill='black', font=font)
    y += 25
    draw.text((70, y), "HEENT: Pupils equal, reactive to light. No neck stiffness.", fill='black', font=font)
    y += 25
    draw.text((70, y), "Cardiovascular: Regular rate and rhythm, no murmurs", fill='black', font=font)
    y += 25
    draw.text((70, y), "Respiratory: Clear to auscultation bilaterally", fill='black', font=font)
    y += 25
    draw.text((70, y), "Neurological: Cranial nerves II-XII intact", fill='black', font=font)
    y += 40
    
    # Assessment
    draw.text((50, y), "Assessment:", fill='black', font=font)
    y += 25
    draw.text((70, y), "1. Tension headache, likely stress-related", fill='black', font=font)
    y += 25
    draw.text((70, y), "2. Rule out migraine", fill='black', font=font)
    y += 40
    
    # Plan
    draw.text((50, y), "Plan:", fill='black', font=font)
    y += 25
    draw.text((70, y), "1. Prescribe ibuprofen 400mg TID for pain relief", fill='black', font=font)
    y += 25
    draw.text((70, y), "2. Recommend stress management techniques", fill='black', font=font)
    y += 25
    draw.text((70, y), "3. Follow-up in 1 week if symptoms persist", fill='black', font=font)
    y += 25
    draw.text((70, y), "4. Patient education on headache triggers", fill='black', font=font)
    y += 60
    
    # Signature area
    draw.text((50, y), "Provider:", fill='black', font=font)
    y += 25
    draw.text((70, y), "Dr. Jennifer Martinez, MD", fill='black', font=font)
    y += 25
    draw.text((70, y), "Internal Medicine", fill='black', font=font)
    
    # Add some "handwritten" style irregularities by slightly rotating some text
    # This is simulated - real handwriting would be much more irregular
    
    img.save(output_path, 'PNG', quality=90)
    print(f"Created handwritten medical note: {output_path}")

def create_financial_statement(output_path):
    """Create a financial statement with tables"""
    img = Image.new('RGB', (850, 1100), color='white')
    draw = ImageDraw.Draw(img)
    
    try:
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
        header_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
        body_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except:
        title_font = header_font = body_font = ImageFont.load_default()
    
    y = 50
    
    # Header
    draw.text((250, y), "HEALTHTECH SOLUTIONS INC.", fill='black', font=title_font)
    y += 35
    draw.text((300, y), "QUARTERLY FINANCIAL STATEMENT", fill='black', font=header_font)
    y += 25
    draw.text((350, y), "Q2 2025", fill='black', font=header_font)
    y += 50
    
    # Revenue table
    draw.text((50, y), "REVENUE BREAKDOWN", fill='black', font=header_font)
    y += 30
    
    # Table borders
    table_left = 50
    table_right = 750
    row_height = 25
    
    # Headers
    draw.rectangle([(table_left, y), (table_right, y + row_height)], outline='black', width=2)
    draw.text((60, y + 5), "Revenue Source", fill='black', font=header_font)
    draw.text((300, y + 5), "Q2 2025", fill='black', font=header_font)
    draw.text((450, y + 5), "Q1 2025", fill='black', font=header_font)
    draw.text((600, y + 5), "Growth %", fill='black', font=header_font)
    y += row_height
    
    # Data rows
    revenue_data = [
        ("OCR Software Licenses", "$2,450,000", "$2,180,000", "+12.4%"),
        ("Professional Services", "$1,850,000", "$1,920,000", "-3.6%"),
        ("Support & Maintenance", "$980,000", "$920,000", "+6.5%"),
        ("Cloud Subscriptions", "$1,200,000", "$1,050,000", "+14.3%"),
        ("Training & Consulting", "$450,000", "$380,000", "+18.4%")
    ]
    
    for source, q2, q1, growth in revenue_data:
        draw.rectangle([(table_left, y), (table_right, y + row_height)], outline='black', width=1)
        draw.text((60, y + 5), source, fill='black', font=body_font)
        draw.text((310, y + 5), q2, fill='black', font=body_font)
        draw.text((460, y + 5), q1, fill='black', font=body_font)
        draw.text((610, y + 5), growth, fill='black', font=body_font)
        y += row_height
    
    # Total row
    draw.rectangle([(table_left, y), (table_right, y + row_height)], outline='black', width=2)
    draw.text((60, y + 5), "TOTAL REVENUE", fill='black', font=header_font)
    draw.text((310, y + 5), "$6,930,000", fill='black', font=header_font)
    draw.text((460, y + 5), "$6,450,000", fill='black', font=header_font)
    draw.text((610, y + 5), "+7.4%", fill='black', font=header_font)
    y += row_height + 40
    
    # Expenses section
    draw.text((50, y), "OPERATING EXPENSES", fill='black', font=header_font)
    y += 30
    
    # Expenses table
    draw.rectangle([(table_left, y), (table_right, y + row_height)], outline='black', width=2)
    draw.text((60, y + 5), "Expense Category", fill='black', font=header_font)
    draw.text((300, y + 5), "Q2 2025", fill='black', font=header_font)
    draw.text((450, y + 5), "% of Revenue", fill='black', font=header_font)
    draw.text((600, y + 5), "Budget Variance", fill='black', font=header_font)
    y += row_height
    
    expense_data = [
        ("Research & Development", "$1,950,000", "28.1%", "-$50,000"),
        ("Sales & Marketing", "$1,650,000", "23.8%", "+$75,000"),
        ("General & Administrative", "$850,000", "12.3%", "-$25,000"),
        ("Customer Support", "$420,000", "6.1%", "+$15,000"),
        ("Infrastructure & IT", "$380,000", "5.5%", "-$20,000")
    ]
    
    for category, amount, percentage, variance in expense_data:
        draw.rectangle([(table_left, y), (table_right, y + row_height)], outline='black', width=1)
        draw.text((60, y + 5), category, fill='black', font=body_font)
        draw.text((310, y + 5), amount, fill='black', font=body_font)
        draw.text((460, y + 5), percentage, fill='black', font=body_font)
        draw.text((610, y + 5), variance, fill='black', font=body_font)
        y += row_height
    
    # Total expenses
    draw.rectangle([(table_left, y), (table_right, y + row_height)], outline='black', width=2)
    draw.text((60, y + 5), "TOTAL EXPENSES", fill='black', font=header_font)
    draw.text((310, y + 5), "$5,250,000", fill='black', font=header_font)
    draw.text((460, y + 5), "75.8%", fill='black', font=header_font)
    draw.text((610, y + 5), "-$5,000", fill='black', font=header_font)
    y += row_height + 40
    
    # Net income
    draw.rectangle([(table_left, y), (table_right, y + row_height)], outline='black', width=3)
    draw.text((60, y + 5), "NET INCOME", fill='black', font=title_font)
    draw.text((310, y + 5), "$1,680,000", fill='black', font=title_font)
    draw.text((460, y + 5), "24.2%", fill='black', font=title_font)
    y += row_height + 40
    
    # Footer notes
    draw.text((50, y), "Notes:", fill='black', font=header_font)
    y += 25
    draw.text((50, y), "• Strong growth in cloud subscriptions driven by increased demand", fill='black', font=body_font)
    y += 20
    draw.text((50, y), "• R&D investment focused on AI-powered OCR improvements", fill='black', font=body_font)
    y += 20
    draw.text((50, y), "• Marketing expenses increased for new product launch", fill='black', font=body_font)
    
    img.save(output_path, 'PNG', quality=95)
    print(f"Created financial statement: {output_path}")

def main():
    output_dir = "test-files/real-content"
    os.makedirs(output_dir, exist_ok=True)
    
    print("Creating realistic test files with actual content...")
    
    try:
        # Create various types of realistic documents
        create_realistic_medical_bill(os.path.join(output_dir, "medical-bill-realistic.png"))
        create_research_paper_excerpt(os.path.join(output_dir, "research-paper.png"))
        create_handwritten_note(os.path.join(output_dir, "handwritten-note.png"))
        create_financial_statement(os.path.join(output_dir, "financial-statement.png"))
        
        print("\nCreated 4 realistic test files:")
        print("1. medical-bill-realistic.png - Detailed medical bill with services and costs")
        print("2. research-paper.png - Academic research paper excerpt")
        print("3. handwritten-note.png - Medical progress notes")
        print("4. financial-statement.png - Financial report with tables")
    except Exception as e:
        print(f"Error creating files: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
