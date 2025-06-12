#!/usr/bin/env python3
"""
Create test PDF files for OCR testing
This script generates PDFs with controlled content for testing OCR quality and error handling
"""

import argparse
import os
import random
import sys
from pathlib import Path
import textwrap

# Try to import PDF generation libraries
try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.pdfgen import canvas
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False
    print("Warning: reportlab not installed. Limited PDF generation available.")

def create_simple_pdf(output_path, pages=5, page_size='letter', content_type='text'):
    """Create a simple PDF file with the specified number of pages"""
    if not HAS_REPORTLAB:
        print("Error: reportlab is required for PDF creation")
        return False
    
    # Set page size
    if page_size.lower() == 'a4':
        pdf_page_size = A4
    else:
        pdf_page_size = letter
    
    # Create the PDF document
    doc = SimpleDocTemplate(output_path, pagesize=pdf_page_size)
    styles = getSampleStyleSheet()
    
    # Create custom style for main text
    styles.add(ParagraphStyle(
        name='MainText',
        parent=styles['Normal'],
        fontSize=11,
        leading=14,
        spaceAfter=12
    ))
    
    # Create a list for the document content
    content = []
    
    # Add content based on type
    for page in range(1, pages + 1):
        # Add page header
        content.append(Paragraph(f"<b>Test PDF for OCR - Page {page}</b>", styles['Heading1']))
        content.append(Spacer(1, 0.2 * inch))
        
        if content_type == 'text':
            # Add paragraphs of text
            for i in range(3):
                paragraph_text = generate_test_text(complexity='medium')
                content.append(Paragraph(paragraph_text, styles['MainText']))
                content.append(Spacer(1, 0.1 * inch))
        
        elif content_type == 'table':
            # Add a table
            content.append(Paragraph("<b>Sample Table Data</b>", styles['Heading2']))
            content.append(Spacer(1, 0.1 * inch))
            
            table_data = generate_test_table()
            table = Table(table_data, colWidths=[1.2*inch] * len(table_data[0]))
            
            # Add table style
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            content.append(table)
            content.append(Spacer(1, 0.2 * inch))
            
            # Add some text after the table
            content.append(Paragraph(generate_test_text(complexity='simple'), styles['MainText']))
        
        elif content_type == 'mixed':
            # Add mixed content
            # Text paragraph
            content.append(Paragraph(generate_test_text(complexity='medium'), styles['MainText']))
            content.append(Spacer(1, 0.1 * inch))
            
            # Small table
            table_data = generate_test_table(rows=3, cols=3)
            table = Table(table_data, colWidths=[1.5*inch] * len(table_data[0]))
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            content.append(table)
            content.append(Spacer(1, 0.2 * inch))
            
            # More text
            content.append(Paragraph(generate_test_text(complexity='simple'), styles['MainText']))
        
        # Add page break if not the last page
        if page < pages:
            content.append(Spacer(1, 0.5 * inch))
    
    # Build the PDF
    doc.build(content)
    print(f"Created PDF with {pages} pages at: {output_path}")
    return True

def generate_test_text(complexity='medium'):
    """Generate sample text for the PDF"""
    if complexity == 'simple':
        texts = [
            "This is a simple test document for OCR processing.",
            "It contains basic text that should be easy to recognize.",
            "The quality of OCR depends on image resolution and clarity.",
            "Most modern OCR systems can handle standard fonts well.",
            "This sample text helps evaluate OCR accuracy."
        ]
        return " ".join(random.sample(texts, 3))
    
    elif complexity == 'medium':
        paragraphs = [
            "Optical Character Recognition (OCR) is the process of converting images of text into machine-readable text. "
            "It's commonly used for digitizing printed documents so they can be edited, searched, and stored more compactly.",
            
            "The OCR process typically involves several steps: image acquisition, preprocessing, feature extraction, "
            "recognition, and post-processing. Modern OCR systems often use neural networks and deep learning techniques.",
            
            "OCR accuracy can vary depending on the quality of the original document, font styles, layout complexity, "
            "and the presence of non-text elements. Clean, high-contrast documents generally yield better results.",
            
            "Applications of OCR include document digitization, automated data entry, assisting visually impaired individuals, "
            "license plate recognition, and processing business documents like invoices and receipts.",
            
            "Testing OCR systems requires a diverse set of documents that represent real-world use cases. "
            "This test document provides a controlled sample with known content for evaluating OCR performance."
        ]
        return random.choice(paragraphs)
    
    else:  # complex
        complex_text = (
            "The development of OCR technology began in the early 20th century with Emanuel Goldberg's "
            "statistical machine and Edmund Fournier d'Albe's Optophone. Early OCR systems were primitive "
            "by today's standards, often designed to recognize specific fonts or characters rather than "
            "general text. The first commercial OCR systems appeared in the 1950s, with companies like IBM "
            "developing specialized machines for reading standardized documents. By the 1970s, Ray Kurzweil "
            "had developed the first omni-font OCR system capable of recognizing text printed in virtually "
            "any normal font. Modern OCR utilizes deep learning techniques, convolutional neural networks, "
            "and transformer models to achieve increasingly accurate results on complex documents with "
            "varying layouts, fonts, and image qualities."
        )
        return textwrap.fill(complex_text, width=80)

def generate_test_table(rows=5, cols=4):
    """Generate a sample table for the PDF"""
    # Create header row
    table_data = [['Header ' + str(i) for i in range(1, cols + 1)]]
    
    # Create data rows
    for i in range(1, rows):
        row_data = []
        for j in range(1, cols + 1):
            # Mix of numbers and text
            if j % 2 == 0:
                row_data.append(str(random.randint(100, 999)))
            else:
                row_data.append(f"Item {i}-{j}")
        table_data.append(row_data)
    
    return table_data

def create_medical_bill_pdf(output_path):
    """Create a test PDF that simulates a medical bill for specialized testing"""
    if not HAS_REPORTLAB:
        print("Error: reportlab is required for medical bill PDF creation")
        return False
    
    # Create the PDF document
    doc = SimpleDocTemplate(output_path, pagesize=letter)
    styles = getSampleStyleSheet()
    
    # Add custom styles
    styles.add(ParagraphStyle(
        name='BillHeader',
        parent=styles['Heading1'],
        fontSize=14,
        alignment=1  # Center alignment
    ))
    
    styles.add(ParagraphStyle(
        name='BillSubHeader',
        parent=styles['Heading2'],
        fontSize=12
    ))
    
    styles.add(ParagraphStyle(
        name='BillText',
        parent=styles['Normal'],
        fontSize=10,
        leading=12
    ))
    
    # Create content
    content = []
    
    # Header
    content.append(Paragraph("MEDICAL CENTER BILLING STATEMENT", styles['BillHeader']))
    content.append(Spacer(1, 0.1 * inch))
    content.append(Paragraph("Patient Statement of Services", styles['BillSubHeader']))
    content.append(Spacer(1, 0.3 * inch))
    
    # Patient information
    patient_info = [
        ['Patient Name:', 'SMITH, JOHN A'],
        ['Patient ID:', 'MRN123456789'],
        ['Date of Birth:', '01/15/1975'],
        ['Service Date:', '05/03/2023'],
        ['Provider:', 'DR. SARAH JOHNSON']
    ]
    
    patient_table = Table(patient_info, colWidths=[1.5*inch, 3*inch])
    patient_table.setStyle(TableStyle([
        ('FONT', (0, 0), (-1, -1), 'Helvetica'),
        ('FONT', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    
    content.append(patient_table)
    content.append(Spacer(1, 0.3 * inch))
    
    # Services table
    content.append(Paragraph("SERVICES PROVIDED", styles['BillSubHeader']))
    content.append(Spacer(1, 0.1 * inch))
    
    services = [
        ['Date', 'Service Description', 'CPT Code', 'Charge', 'Insurance Paid', 'You Owe'],
        ['05/03/23', 'Office Visit - Established Patient, Level 3', '99213', '$125.00', '$85.00', '$40.00'],
        ['05/03/23', 'Complete Blood Count (CBC)', '85027', '$45.00', '$36.00', '$9.00'],
        ['05/03/23', 'Comprehensive Metabolic Panel', '80053', '$65.00', '$52.00', '$13.00'],
        ['05/03/23', 'Lipid Panel', '80061', '$55.00', '$44.00', '$11.00'],
        ['05/03/23', 'Thyroid Stimulating Hormone (TSH)', '84443', '$75.00', '$60.00', '$15.00']
    ]
    
    services_table = Table(services, colWidths=[0.8*inch, 2.5*inch, 0.8*inch, 0.8*inch, 0.8*inch, 0.8*inch])
    services_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (1, 1), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    content.append(services_table)
    content.append(Spacer(1, 0.2 * inch))
    
    # Summary table
    summary = [
        ['Total Charges:', '$365.00'],
        ['Insurance Payments:', '-$277.00'],
        ['Adjustments:', '-$0.00'],
        ['Previous Payments:', '-$0.00'],
        ['Current Balance Due:', '$88.00']
    ]
    
    summary_table = Table(summary, colWidths=[3*inch, 1*inch])
    summary_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONT', (0, -1), (1, -1), 'Helvetica-Bold'),
        ('LINEABOVE', (0, -1), (1, -1), 1, colors.black),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    
    content.append(Spacer(1, 0.1 * inch))
    content.append(summary_table)
    content.append(Spacer(1, 0.3 * inch))
    
    # Payment instructions
    content.append(Paragraph("PAYMENT INSTRUCTIONS", styles['BillSubHeader']))
    content.append(Spacer(1, 0.1 * inch))
    content.append(Paragraph(
        "Please remit payment within 30 days. Make checks payable to Medical Center. "
        "To pay online, visit www.medicalcenter.example.com and use your Patient ID as login.", 
        styles['BillText']
    ))
    content.append(Spacer(1, 0.1 * inch))
    content.append(Paragraph(
        "For billing questions, contact Patient Financial Services at (555) 123-4567.", 
        styles['BillText']
    ))
    
    # Build the PDF
    doc.build(content)
    print(f"Created medical bill test PDF at: {output_path}")
    return True

def main():
    parser = argparse.ArgumentParser(description='Create test PDF files for OCR testing')
    parser.add_argument('--output', required=True, help='Output PDF file path')
    parser.add_argument('--pages', type=int, default=5, help='Number of pages (default: 5)')
    parser.add_argument('--type', choices=['text', 'table', 'mixed', 'medical'], default='text',
                        help='Content type: text, table, mixed, or medical (default: text)')
    parser.add_argument('--size', choices=['letter', 'a4'], default='letter',
                        help='Page size: letter or a4 (default: letter)')
    
    args = parser.parse_args()
    
    # Check if reportlab is available
    if not HAS_REPORTLAB:
        print("Error: The reportlab library is required but not installed.")
        print("Please install it with: pip install reportlab")
        sys.exit(1)
    
    # Create output directory if it doesn't exist
    output_dir = os.path.dirname(args.output)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Create the appropriate type of PDF
    if args.type == 'medical':
        success = create_medical_bill_pdf(args.output)
    else:
        success = create_simple_pdf(args.output, args.pages, args.size, args.type)
    
    if success:
        print(f"PDF created successfully: {args.output}")
    else:
        print("Failed to create PDF")
        sys.exit(1)

if __name__ == "__main__":
    main()
