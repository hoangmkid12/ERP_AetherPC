const fs = require('fs');
const path = require('path');
const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    PageBreak
} = require('docx');

// Configuration
const args = process.argv.slice(2);
const baseName = args[0] ? args[0].replace(/\.md$/, '') : 'BaoCao_KLTN_ERP_LinhKienMayTinh';
const INPUT_MD = path.join(__dirname, `${baseName}.md`);
const OUTPUT_DOCX = path.join(__dirname, `${baseName}.docx`);

// Fonts and Styles
const FONT_FAMILY = 'Times New Roman';
const COLOR_PRIMARY = '002060'; // Dark Blue for major headings
const COLOR_SECONDARY = '595959'; // Slate for sub-headings
const COLOR_TEXT = '000000';

function parseMarkdown(mdText) {
    const lines = mdText.split(/\r?\n/);
    const elements = [];
    let i = 0;

    while (i < lines.length) {
        let line = lines[i];

        // 1. Code Block
        if (line.trim().startsWith('```')) {
            const lang = line.trim().substring(3).trim();
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            elements.push({
                type: 'code_block',
                language: lang,
                code: codeLines.join('\n')
            });
            i++;
            continue;
        }

        // 2. Table
        if (line.trim().startsWith('|')) {
            const tableLines = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i]);
                i++;
            }
            // Parse table lines
            const rows = [];
            for (let j = 0; j < tableLines.length; j++) {
                const tLine = tableLines[j].trim();
                // Skip separator rows like |---|---|
                if (tLine.includes('---') && !tLine.match(/[a-zA-Z0-9]/)) {
                    continue;
                }
                const cells = tLine
                    .split('|')
                    .map(c => c.trim())
                    .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1); // remove outer empty elements
                if (cells.length > 0) {
                    rows.push({
                        isHeader: rows.length === 0,
                        cells: cells
                    });
                }
            }
            elements.push({
                type: 'table',
                rows: rows
            });
            continue;
        }

        // 3. Blockquote / Alert
        if (line.trim().startsWith('>')) {
            const quoteLines = [];
            while (i < lines.length && lines[i].trim().startsWith('>')) {
                quoteLines.push(lines[i].trim().substring(1).trim());
                i++;
            }
            elements.push({
                type: 'blockquote',
                text: quoteLines.join(' ')
            });
            continue;
        }

        // 4. Horizontal Rule
        if (line.trim() === '---' || line.trim() === '***') {
            elements.push({
                type: 'horizontal_rule'
            });
            i++;
            continue;
        }

        // 5. Headings
        if (line.startsWith('#')) {
            let level = 0;
            while (line[level] === '#') {
                level++;
            }
            const text = line.substring(level).trim();
            elements.push({
                type: 'heading',
                level: level,
                text: text
            });
            i++;
            continue;
        }

        // 6. Bullet lists
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            const listItems = [];
            while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
                listItems.push({
                    text: lines[i].trim().substring(2).trim(),
                    level: 0
                });
                i++;
            }
            elements.push({
                type: 'bullet_list',
                items: listItems
            });
            continue;
        }

        // 7. Numbered lists
        const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
            const listItems = [];
            while (i < lines.length) {
                const innerLine = lines[i].trim();
                const match = innerLine.match(/^(\d+)\.\s+(.*)/);
                if (match) {
                    listItems.push({
                        num: parseInt(match[1]),
                        text: match[2].trim()
                    });
                    i++;
                } else {
                    break;
                }
            }
            elements.push({
                type: 'numbered_list',
                items: listItems
            });
            continue;
        }

        // 8. Empty lines
        if (line.trim() === '') {
            elements.push({
                type: 'empty_line'
            });
            i++;
            continue;
        }

        // 9. Standard Paragraph
        elements.push({
            type: 'paragraph',
            text: line.trim()
        });
        i++;
    }

    return elements;
}

// Convert inline formatting like **bold** to docx TextRuns
function formatInlineText(text) {
    if (!text) return [new TextRun("")];
    
    const runs = [];
    let currentIdx = 0;

    const regex = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const precedingText = text.substring(currentIdx, match.index);
        if (precedingText) {
            runs.push(new TextRun({
                text: precedingText,
                font: FONT_FAMILY,
                size: 26, // 13pt
                color: COLOR_TEXT
            }));
        }

        const isBold = !!(match[1] && (match[1] === '**' || match[1] === '__'));
        const matchedText = match[2] || match[4];

        runs.push(new TextRun({
            text: matchedText,
            bold: isBold,
            italics: !isBold,
            font: FONT_FAMILY,
            size: 26,
            color: COLOR_TEXT
        }));

        currentIdx = regex.lastIndex;
    }

    const remainingText = text.substring(currentIdx);
    if (remainingText) {
        runs.push(new TextRun({
            text: remainingText,
            font: FONT_FAMILY,
            size: 26,
            color: COLOR_TEXT
        }));
    }

    return runs;
}

function generateDocx(elements) {
    const children = [];

    // Create Title / Cover Page
    children.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 100 },
            children: [
                new TextRun({
                    text: "TRƯỜNG ĐẠI HỌC CÔNG NGHỆ",
                    bold: true,
                    font: FONT_FAMILY,
                    size: 28,
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 800 },
            children: [
                new TextRun({
                    text: "KHOA HỆ THỐNG THÔNG TIN",
                    bold: true,
                    font: FONT_FAMILY,
                    size: 28,
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 800, after: 400 },
            children: [
                new TextRun({
                    text: "KHÓA LUẬN TỐT NGHIỆP ĐẠI HỌC",
                    bold: true,
                    font: FONT_FAMILY,
                    size: 32,
                    color: COLOR_PRIMARY
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
            children: [
                new TextRun({
                    text: "HỆ THỐNG ERP BÁN LINH KIỆN MÁY TÍNH TÍCH HỢP TRÍ TUỆ NHÂN TẠO (AI)",
                    bold: true,
                    font: FONT_FAMILY,
                    size: 36,
                    color: COLOR_PRIMARY
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 1200 },
            children: [
                new TextRun({
                    text: "AETHERPC ERP SYSTEM",
                    italics: true,
                    bold: true,
                    font: FONT_FAMILY,
                    size: 28,
                    color: COLOR_SECONDARY
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 1200, after: 100 },
            children: [
                new TextRun({
                    text: "Ngành: Hệ Thống Thông Tin",
                    font: FONT_FAMILY,
                    size: 28,
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 1500 },
            children: [
                new TextRun({
                    text: "Mã số ngành: 7480104",
                    font: FONT_FAMILY,
                    size: 28,
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 800, after: 100 },
            children: [
                new TextRun({
                    text: "Sinh viên thực hiện: Nguyễn Văn A",
                    bold: true,
                    font: FONT_FAMILY,
                    size: 26,
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 0, after: 100 },
            children: [
                new TextRun({
                    text: "Mã số sinh viên: 2202xxxx",
                    font: FONT_FAMILY,
                    size: 26,
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 0, after: 1500 },
            children: [
                new TextRun({
                    text: "Giảng viên hướng dẫn: TS. Nguyễn Văn B",
                    bold: true,
                    font: FONT_FAMILY,
                    size: 26,
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 800, after: 200 },
            children: [
                new TextRun({
                    text: "Hà Nội - 2026",
                    bold: true,
                    font: FONT_FAMILY,
                    size: 26,
                })
            ]
        }),
        new Paragraph({
            children: [new PageBreak()]
        })
    );

    // Build main content
    elements.forEach(el => {
        switch (el.type) {
            case 'heading': {
                let size = 26;
                let bold = true;
                let color = COLOR_TEXT;
                let before = 240;
                let after = 120;

                if (el.level === 1) {
                    size = 32;
                    color = COLOR_PRIMARY;
                    before = 400;
                    after = 200;
                } else if (el.level === 2) {
                    size = 28;
                    color = COLOR_SECONDARY;
                    before = 300;
                    after = 150;
                } else if (el.level === 3) {
                    size = 26;
                    color = COLOR_SECONDARY;
                    before = 240;
                    after = 120;
                }

                children.push(
                    new Paragraph({
                        spacing: { before, after },
                        keepWithNext: true,
                        children: [
                            new TextRun({
                                text: el.text,
                                bold,
                                font: FONT_FAMILY,
                                size,
                                color
                            })
                        ]
                    })
                );
                break;
            }

            case 'paragraph': {
                if (el.text.trim() === '') break;
                children.push(
                    new Paragraph({
                        spacing: { before: 100, after: 100, line: 360 }, // Correct nesting of line spacing
                        children: formatInlineText(el.text)
                    })
                );
                break;
            }

            case 'bullet_list': {
                el.items.forEach(item => {
                    children.push(
                        new Paragraph({
                            spacing: { before: 60, after: 60, line: 360 }, // Correct nesting of line spacing
                            indent: { left: 360 },
                            children: [
                                new TextRun({
                                    text: "•   ",
                                    font: FONT_FAMILY,
                                    size: 26,
                                    color: COLOR_TEXT
                                }),
                                ...formatInlineText(item.text)
                            ]
                        })
                    );
                });
                break;
            }

            case 'numbered_list': {
                el.items.forEach(item => {
                    children.push(
                        new Paragraph({
                            spacing: { before: 60, after: 60, line: 360 }, // Correct nesting of line spacing
                            children: [
                                new TextRun({
                                    text: `${item.num}. `,
                                    bold: true,
                                    font: FONT_FAMILY,
                                    size: 26
                                }),
                                ...formatInlineText(item.text)
                            ]
                        })
                    );
                });
                break;
            }

            case 'code_block': {
                // Render code blocks as raw Consolas paragraphs
                el.code.split('\n').forEach(cLine => {
                    children.push(
                        new Paragraph({
                            spacing: { before: 20, after: 20 },
                            indent: { left: 720 },
                            children: [
                                new TextRun({
                                    text: cLine,
                                    font: 'Consolas',
                                    size: 20,
                                    color: '000000'
                                })
                            ]
                        })
                    );
                });
                break;
            }

            case 'blockquote': {
                // Render blockquotes as italicized indented text
                children.push(
                    new Paragraph({
                        spacing: { before: 100, after: 100 },
                        indent: { left: 720 },
                        children: [
                            new TextRun({
                                text: `> ${el.text}`,
                                italics: true,
                                font: FONT_FAMILY,
                                size: 24,
                                color: '444444'
                            })
                        ]
                    })
                );
                break;
            }

            case 'table': {
                // Render tables as plain indented paragraphs joining cells with " | "
                el.rows.forEach(row => {
                    children.push(
                        new Paragraph({
                            spacing: { before: 60, after: 60 },
                            indent: { left: 720 },
                            children: [
                                new TextRun({
                                    text: row.cells.join('  |  '),
                                    bold: row.isHeader,
                                    font: FONT_FAMILY,
                                    size: 24
                                })
                            ]
                        })
                    );
                });
                break;
            }

            case 'horizontal_rule': {
                children.push(
                    new Paragraph({
                        spacing: { before: 200, after: 200 },
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: "❖   ❖   ❖",
                                bold: true,
                                font: FONT_FAMILY,
                                size: 28,
                                color: COLOR_SECONDARY
                            })
                        ]
                    })
                );
                break;
            }
        }
    });

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: 1134,
                        bottom: 1134,
                        left: 1701,
                        right: 1134
                    }
                }
            },
            children: children
        }]
    });

    return doc;
}

// Main Execution
try {
    console.log("Reading Markdown file...");
    const mdText = fs.readFileSync(INPUT_MD, 'utf-8');
    
    console.log("Parsing Markdown contents...");
    const elements = parseMarkdown(mdText);
    console.log(`Successfully parsed ${elements.length} markdown elements.`);

    console.log("Generating Word Document object...");
    const doc = generateDocx(elements);

    console.log("Writing to file...");
    Packer.toBase64String(doc).then(base64Str => {
        fs.writeFileSync(OUTPUT_DOCX, base64Str, 'base64');
        console.log(`Document successfully compiled to: ${OUTPUT_DOCX}`);
        process.exit(0);
    }).catch(err => {
        console.error("Packer error:", err);
        process.exit(1);
    });

} catch (err) {
    console.error("Error during conversion:", err);
    process.exit(1);
}
