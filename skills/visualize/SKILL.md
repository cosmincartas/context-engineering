---
name: visualize
description: Turn a Markdown source into a complete, source-grounded standalone HTML view. Keep Markdown authoritative.
---

# Visualize

Use ASD-STE100 Simplified Technical English in instructions and generated descriptions. Preserve source wording when it is a contract, requirement, identifier, or evidence.

## Purpose

Use this skill to present a Markdown source as a derived HTML view. The Markdown remains authoritative. The HTML does not create a new requirement, approval, or verification lifecycle.

Do not edit the Markdown source. Do not change other skills, project configuration, or dependencies. Do not build a converter, app, or runtime service.

## Inputs and output

- Read the full Markdown source, including front matter, tables, code fences, appendices, and linked local evidence that the source requires readers to use.
- Use the requested output path. If none is given, use a sibling file with the same base name and `.html` extension.
- Show the complete source by default. Include every section, identifier, decision, approval record, verification result, limitation, and reference that affects meaning.
- Use a narrower view only when the user names its scope. State the included sections and omitted sections in the HTML.
- If the output file already exists, do not overwrite it. Ask the user before replacing it. Preserve an existing file if the user does not approve replacement.
- Keep the HTML separate from the source. Do not write generated markup into the Markdown file.

## Workflow

1. Resolve the source path and output path. Confirm they are different files. Stop if they resolve to the same file. Read the complete source before selecting a layout.
2. Record the source path, exact SHA-256 hash, and current UTC time. Use `sha256sum` or Python's standard `hashlib` module. Do not invent a hash or time.
3. Select a recipe from [references/recipes.md](references/recipes.md). State the recipe and coverage in the HTML. Select blocks because they answer the reader's question, not because every block exists.
4. Assemble a page from [assets/document-shell.html](assets/document-shell.html), [assets/styles.css](assets/styles.css), and the applicable fragments in [assets/blocks/](assets/blocks/). Use [assets/gallery.html](assets/gallery.html) as the visual reference.
5. Keep source facts distinct from proposals, inferences, unknowns, and examples. Preserve source IDs, wording, scope, approval evidence, and verification evidence. Do not create requirements, progress, task states, code, diffs, test results, or diagram edges that the source does not support.
6. Escape all Markdown text for its HTML context. Escape code and diff text as text nodes. Never place source text in an executable context, an event handler, or a URL attribute.
7. Put all page styles in one inline `<style>` element. Put diagrams in inline SVG. Give each SVG a unique ID prefix, a `<title>`, a `<desc>`, and `role="img"` with `aria-labelledby`. Keep the diagram's facts in nearby readable text. If the source contains diagram text, retain it verbatim in a visible, escaped text block beside the SVG.
8. Use no scripts, CDN links, external stylesheets, web fonts, images, embeds, or runtime resources. The output must work offline as one HTML file.
9. Before writing, check whether the output exists. Ask before replacing it. After assembly, hash the source again. If it changed, reread it and rebuild the view from the new source.
10. Check the HTML structure, internal links, unique IDs, SVG labels, escaped code, source metadata, and absence of runtime resources. Confirm that the source file did not change. Report checks you could not run; do not claim them as passed.

## Source and freshness record

Show these items near the top of every generated page:

- Source path, as a readable path.
- SHA-256 hash of the exact source bytes.
- Time of the final source hash check, in UTC.
- Recipe and coverage: `Complete` or an explicit scope with omitted sections.
- Source approval or verification state only when the source states it.

State that the hash was checked at generation time. A static HTML file cannot detect later source changes. Do not call the view current after generation without checking the source hash again.

Keep source approval and verification evidence visible in the derived view. Do not label the HTML as approved or verified unless the source records that state. A view does not start another approval process.

## Assembly rules

- Use the neutral, indigo, and teal visual system in `assets/styles.css`. Keep type clear, spacing generous, and contrast strong.
- Keep headings and source IDs stable. Add navigation only for sections that exist in the view.
- Keep the full text visible by default. Do not hide required content in collapsed panels, tooltips, or hover states.
- Keep table cells and long code lines readable on narrow screens. Use horizontal scrolling only for wide content.
- Repeat a block only when the source needs it. Give repeated page sections unique heading IDs.
- When repeating an SVG, replace every `{{ID_PREFIX}}` token with a different valid ID prefix. Update every matching `id`, `url(#...)`, and `aria-labelledby` reference together. Never duplicate an SVG ID.
- Treat the flow and sequence SVGs as illustrative starter layouts, not fixed semantic graphs. Adjust the topology to supported source facts: add or remove nodes and participants, add, remove, or reroute edges and messages, set their directions, and change the geometry as needed. Labels alone do not change topology. Update labels, title, description, geometry, and all related IDs and references together.
- Keep source diagram text, such as Mermaid code, visible as escaped text with [assets/blocks/diagram-source.html](assets/blocks/diagram-source.html). Do not execute it. If the source has no diagram text, keep an accessible description and a nearby written summary.
- Use diagram text from supported source facts. Mark a proposal as proposed. Keep unsupported branches out of the diagram. If the source gives incomplete information, name the limit in the description.
- For code, show the exact source path and line range when the source provides them. Preserve execution claims as written. Do not imply that displayed code ran.
- For diffs, use only a supplied or verified diff. Preserve each line, sign, order, and hunk. Escape it for HTML. Never invent a change or infer a diff from prose.
- For requirements, preserve exact IDs, statements, selection states, sources, verification, and approval evidence. Do not add, merge, renumber, or upgrade a requirement.
- For milestones, preserve exact task IDs and dependencies. Show progress only when the source contains attributable progress evidence. A plan alone is not evidence of execution.

## Assets

The assets are authoring material, not runtime dependencies. Copy the needed markup into the output. Copy `assets/styles.css` into the shell's single `<style>` element. Inline SVG markup in the page. Do not link to these assets from the delivered HTML.

## Completion response

Report the output path, source path and hash, recipe, coverage, overwrite decision, and checks performed. State any blocked or unavailable check. Do not say the source changed unless a fresh comparison shows that it changed.
