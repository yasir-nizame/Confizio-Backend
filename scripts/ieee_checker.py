import fitz  # PyMuPDF
import re
import sys
import json
from collections import defaultdict
import io

# Force UTF-8 encoding for stdout and stderr
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def check_ieee_formatting(pdf_buffer):
    try:
        if not pdf_buffer or len(pdf_buffer) < 100:
            raise ValueError("PDF buffer is empty or too small")

        doc = fitz.open(stream=pdf_buffer, filetype="pdf")
        results = []
        full_text = "\n".join(page.get_text() for page in doc).lower()

        # Helper function for font check
        def is_times_new_roman(font_name):
            return any(x in font_name.lower() for x in ["times", "roman", "tim", "tmr"])
        
       
        # Layout analysis: Check up to 5 pages
        num_pages_to_check = min(10, len(doc))
        two_column_pages = 0
        fonts = set()
        body_font_size = None
        body_font_size_rounded = None
        pages_with_page_numbers = 0

        for i in range(num_pages_to_check):
            page = doc[i]
            text_dict = page.get_text("dict")
            blocks = text_dict.get("blocks", [])
            page_width = page.mediabox[2]  # Page width from media box
            gap_threshold = page_width / 4  # Dynamic threshold: quarter of page width

            # Step 1: Collect lines from text blocks, excluding potential headers
            lines = []
            for block in blocks:
                if block["type"] == 0 and block["bbox"][1] > 100:  # Exclude headers
                    for line in block["lines"]:
                        lines.append(line["bbox"])

            # Step 2: Group lines by vertical position (y0) into bins
            y_bin_dict = defaultdict(list)
            for line_bbox in lines:
                x0, y0, x1, y1 = line_bbox
                y_bin = round(y0 / 10) * 10  # Bin size of 10 points
                y_bin_dict[y_bin].append(x0)

            # Step 3: Analyze each y_bin for evidence of multiple columns
            multiple_column_bins = 0
            total_bins_with_at_least_two_lines = 0
            for y_bin, x0_list in y_bin_dict.items():
                if len(x0_list) >= 2:  # Only consider bins with at least two lines
                    total_bins_with_at_least_two_lines += 1
                    sorted_x0 = sorted(x0_list)
                    gaps = [sorted_x0[j] - sorted_x0[j-1] for j in range(1, len(sorted_x0))]
                    if gaps and max(gaps) > gap_threshold:
                        multiple_column_bins += 1

            # Step 4: Determine if page is two-column based on proportion
            if total_bins_with_at_least_two_lines > 0:
                ratio = multiple_column_bins / total_bins_with_at_least_two_lines
                if ratio > 0.5:  # More than 50% of bins suggest multiple columns
                    two_column_pages += 1

            # Collect fonts for font check
            for font in page.get_fonts():
                fonts.add(font[3])

            # Identify body font size if not already found
            if body_font_size is None:
                for block in blocks:
                    if block["type"] == 0:
                        for line in block["lines"]:
                            for span in line["spans"]:
                                if 8 <= span["size"] <= 12:
                                    body_font_size = span["size"]
                                    body_font_size_rounded = round(body_font_size)
                                    break
                            if body_font_size:
                                break
                        if body_font_size:
                            break

            # Check for page numbers
            has_page_number = any(
                re.search(r"^\s*\d+\s*$", " ".join(span["text"] for line in b["lines"] for span in line["spans"]).strip())
                for b in blocks if b["type"] == 0 and b["bbox"][1] > 50
            )
            if has_page_number:
                pages_with_page_numbers += 1

        # Aggregate results
        two_columns = two_column_pages >= (num_pages_to_check / 2)  # Majority rule
        times_new_roman = any(is_times_new_roman(font) for font in fonts)
        body_font_size_valid = body_font_size is not None and 8 <= body_font_size_rounded <= 12
        no_page_numbers = pages_with_page_numbers == 0

        # Count passing criteria
        passing_criteria = sum([
            1 if two_columns else 0,
            1 if times_new_roman else 0,
            1 if body_font_size_valid else 0,
            1 if no_page_numbers else 0
        ])

        # Pass if at least 3 out of 4 criteria are met
        layout_passed = two_columns and (passing_criteria >= 2)

        # Compile result
        layout_result = {
            "rule": "Layout",
            "passed": layout_passed,
            "message": f"Two-column layout: {two_columns}, Times New Roman: {times_new_roman}, Body font ~10 pt: {body_font_size_rounded if body_font_size else None}, No page numbers: {no_page_numbers}"
        }

        # Suggestions for failed criteria
        suggestions = []
        if not two_columns:
            suggestions.append(f"Two column format not found, Use a two-column layout.")
        if not times_new_roman:
            suggestions.append("Use Times New Roman or a similar font for the body text.")
        if not body_font_size_valid:
            if body_font_size is None:
                suggestions.append("Set body font size between 8 and 12 points (ideally ~10 pt).")
            else:
                suggestions.append(f"Body font size is {body_font_size} pt (rounded to {body_font_size_rounded} pt); adjust to 8-12 pt.")
        if not no_page_numbers:
            suggestions.append("Remove page numbers from the document.")
        if suggestions:
            layout_result["suggestion"] = " ".join(suggestions)

        results.append(layout_result)
        
        # 2. Title Detection (Using PyMuPDF)
        title_present = False
        page = doc[0]
        text_dict = page.get_text("dict")
        blocks = text_dict.get("blocks", [])

        # First attempt: Look for title in text blocks
        for block in blocks:
            if block["type"] != 0:  # Skip non-text blocks
                continue
            y0 = block["bbox"][1]
            if y0 > 200:  # Limit to top 200 points
                break
            block_text = " ".join(span["text"] for line in block["lines"] for span in line["spans"]).strip().upper()
            # Skip headers, references, and metadata
            if (
                re.search(r"IEEE|VOL\.|NO\.|\d{4}|\b(SPECIAL SECTION|TRANSACTIONS|JOURNAL|ACCESS)\b", block_text) or
                re.search(r"^\s*\d+\s*$", block_text) or
                re.search(r"RECEIVED\s+THE\b|MEMBER|IEEE|DATE\s+OF\s+PUBLICATION", block_text) or
                re.search(r"^[A-Z]+\s+\d{4}$", block_text) or
                re.search(r"^\[\d+\]", block_text) or
                re.search(r"^(?:[A-Z]\.\s*)+[A-Z]+", block_text)
            ):
                continue
            # Consider the block as a title if it has at least 5 words
            word_count = len(block_text.split())
            if word_count >= 5:
                title_present = True
                break

        # Fallback: Extract raw text from the top region and check for a title
        if not title_present:
            # Clip the top 200 points of the page
            clip_rect = fitz.Rect(0, 0, page.rect.width, 200)
            raw_text = page.get_text("text", clip=clip_rect).strip().upper()
            lines = raw_text.splitlines()
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                # Skip headers, references, and metadata
                if (
                    re.search(r"IEEE|VOL\.|NO\.|\d{4}|\b(SPECIAL SECTION|TRANSACTIONS|JOURNAL|ACCESS)\b", line) or
                    re.search(r"^\s*\d+\s*$", line) or
                    re.search(r"RECEIVED\s+THE\b|MEMBER|IEEE|DATE\s+OF\s+PUBLICATION", line) or
                    re.search(r"^[A-Z]+\s+\d{4}$", line) or
                    re.search(r"^\[\d+\]", line) or
                    re.search(r"^(?:[A-Z]\.\s*)+[A-Z]+", line)
                ):
                    continue
                # Consider the line as a title if it has at least 5 words
                word_count = len(line.split())
                if word_count >= 5:
                    title_present = True
                    break

        title_result = {
            "rule": "Title",
            "passed": title_present,
            "message": "Title found" if title_present else "No title found in the top 200 points of the page"
        }
        if not title_present:
            title_result["suggestion"] = "Ensure a title with at least 5 words is present in the top 200 points of the page."
        results.append(title_result)

        # 3. Abstract
        abstract_match = re.search(r"abstract\s*[-—]?\s*([\s\S]*?)(?=\n\s*(index\s+terms|keywords|i\.|\d+\.|references|$))", full_text, re.I)
        abstract_passed = False
        word_count = 0
        if abstract_match:
            abstract_text = abstract_match.group(1).strip()
            word_count = len(abstract_text.split())
            abstract_passed = 100 <= word_count <= 300
            abstract_result = {
                "rule": "Abstract",
                "passed": abstract_passed,
                "message": f"Abstract found, words: {word_count}"
            }
            if not abstract_passed:
                if word_count < 100:
                    abstract_result["suggestion"] = f"Abstract has {word_count} words; it should have at least 100 words (up to 300 words)."
                elif word_count > 300:
                    abstract_result["suggestion"] = f"Abstract has {word_count} words; it should have no more than 300 words (minimum 100 words)."
            results.append(abstract_result)
        else:
            results.append({
                "rule": "Abstract",
                "passed": False,
                "message": "Abstract not found",
                "suggestion": "Include an abstract section with 100 to 300 words, starting with the word 'Abstract'."
            })

        # 4. Index Terms
        index_terms_match = re.search(
            r"(index\s+terms|keywords)\s*[-—]?\s*([\s\S]*?)(?=\n{2,}|\n\s*[a-zA-Z0-9]+\s*[-—]|\n\s*(i\.|\d+\.|references|manuscript|$))",
            full_text,
            re.I
        )
        index_terms_passed = False
        terms = []
        if index_terms_match:
            terms_text = index_terms_match.group(2).strip()
            terms = [t.strip().rstrip('.') for t in re.split(r"[,;]", terms_text) if t.strip()]
            terms = [t for t in terms if not re.search(r"(received|revised|accepted|publication|supported|e-mail)", t.lower())]
            index_terms_passed = bool(terms)
            index_terms_result = {
                "rule": "Index Terms",
                "passed": index_terms_passed,
                "message": f"Index Terms/Keywords found: {len(terms)} terms"
            }
            if not index_terms_passed:
                index_terms_result["suggestion"] = "Include an 'Index Terms' or 'Keywords' section with a comma-separated list of relevant terms (e.g., 'machine learning, AI, robotics')."
            results.append(index_terms_result)
        else:
            results.append({
                "rule": "Index Terms",
                "passed": False,
                "message": "Index Terms/Keywords not found",
                "suggestion": "Include an 'Index Terms' or 'Keywords' section with a comma-separated list of relevant terms (e.g., 'machine learning, AI, robotics')."
            })

        # 5. Headings
        heading_patterns = {
            "Level 1": r"\n\s*[ivx]+\.\s+[a-z]+",
            "Level 2": r"\n\s*[a-z]\.\s+[a-z]+",
            "Numeric": r"\n\s*\d+\.?\s*[a-z]+"
        }
        headings_passed = any(re.search(p, full_text) for p in heading_patterns.values())
        headings_result = {
            "rule": "Headings",
            "passed": headings_passed,
            "message": f"Headings detected: {headings_passed}"
        }
        if not headings_passed:
            headings_result["suggestion"] = "Use numbered or Roman numeral headings (e.g., 'I. Introduction', '1. Methods', 'A. Background') to structure the document."
        results.append(headings_result)

        # 6. Figures/Tables/Equations
        figs_tables_eqs = False
        for page in doc:
            text_dict = page.get_text("dict")
            for block in text_dict.get("blocks", []):
                if block["type"] == 0 and "lines" in block:
                    block_text = " ".join(span["text"] for line in block["lines"] for span in line["spans"]).lower()
                    if re.search(r"(figure|fig\.?|table)\s+[\divxlcdm\d]+|\(\d+\)", block_text):
                        figs_tables_eqs = True
                        break
            if figs_tables_eqs:
                break
        figs_tables_eqs_result = {
            "rule": "Figures/Tables/Equations",
            "passed": figs_tables_eqs,
            "message": f"Figures, tables, or equations detected: {figs_tables_eqs}"
        }
        if not figs_tables_eqs:
            figs_tables_eqs_result["suggestion"] = "Include at least one figure, table, or equation, labeled as 'Figure 1', 'Table I', or numbered equation (e.g., '(1)')."
        results.append(figs_tables_eqs_result)

       # 7. Optional Elements
        optional_patterns = [
            r"note\s+to\s+practitioners", 
            r"nomenclature", 
            r"appendix", 
            r"acknowledg\s*(?:e|ements|ments)"  # Handles spaces or odd formatting
        ]
        optional_detected = any(re.search(p, full_text, re.I | re.M) for p in optional_patterns)
        optional_result = {
            "rule": "Optional Elements",
            "passed": True,
            "message": f"Optional elements detected: {optional_detected}"
        }
        if not optional_detected:
            optional_result["suggestion"] = "Consider adding optional sections like 'Note to Practitioners', 'Nomenclature', 'Appendix', or 'Acknowledgements' if relevant."
        results.append(optional_result)
        
       # 8. References
        import unicodedata
        full_text_lower = "\n".join(page.get_text("text") for page in doc)
        full_text_lower = unicodedata.normalize("NFKD", full_text_lower).replace("\xa0", " ")
        full_text_lower = re.sub(r"\s+", " ", full_text_lower.lower())
        has_references_section = bool(re.search(r"(references|bibliography|works\s*cited|reference\s*list)", full_text_lower))
        has_numbered_citations = bool(re.search(r"(?<!\d)\[\d+\](?!\d)", full_text))
        references_passed = has_references_section or has_numbered_citations  # Pass if either is True
        references_result = {
            "rule": "References",
            "passed": references_passed,
            "message": f"References section found: {has_references_section}, Numbered citations ([1], [2], etc.): {has_numbered_citations}"
        }
        if not (has_references_section and has_numbered_citations):  # Suggestions if either fails
            suggestions = []
            if not has_references_section:
                suggestions.append("Include a 'References', 'Bibliography', or similar section at the end of the document.")
            if not has_numbered_citations:
                suggestions.append("Use numbered citations in the text (e.g., [1], [2]) corresponding to the references list.")
            references_result["suggestion"] = " ".join(suggestions)
        results.append(references_result)
        # Calculate percentage
        total_weight = 100
        weights = {
            "Layout": 30, "Title": 5, "Abstract": 15, "Index Terms": 10,
            "Headings": 10, "Figures/Tables/Equations": 10,
            "Optional Elements": 5, "References": 15
        }
        percentage = round(
            sum(weights[r["rule"]] for r in results if r["passed"]) / total_weight * 100, 
            2
        )

        doc.close()
        return {"percentage": percentage, "details": results}

    except Exception as e:
        return {"percentage": 0, "details": [{"rule": "Parsing", "passed": False, "message": str(e)}]}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
        try:
            print(f"Reading PDF from: {pdf_path}")
            with open(pdf_path, "rb") as f:
                pdf_buffer = f.read()
            print(f"Read {len(pdf_buffer)} bytes from PDF")
            result = check_ieee_formatting(pdf_buffer)
            print(json.dumps(result, indent=2))
        except Exception as e:
            print(json.dumps({"percentage": 0, "details": [{"rule": "Input", "passed": False, "message": f"Failed to read file: {str(e)}"}]}, indent=2))
    else:
        try:
            print("Reading PDF from stdin...")
            pdf_buffer = sys.stdin.buffer.read()
            print(f"Read {len(pdf_buffer)} bytes from stdin")
            result = check_ieee_formatting(pdf_buffer)
            print(json.dumps(result))
        except Exception as e:
            print(json.dumps({"percentage": 0, "details": [{"rule": "Input", "passed": False, "message": f"Failed to read stdin: {str(e)}"}]}))
