# Figure checker: measured facts and limits

`check_figure.py FILE --journals JSON [--journal ID] [--width ID] [--kind KIND]
[--use figure|graphical-abstract] [--artwork photo|combination|lineArt] [--out JSON]`

Output implements `gaid-figure-check/v1`; paths are relative to the current project sandbox,
which must also be the caller's working directory. A content hash keys the result; timestamps
and `rulesCheckedAt` identify file inspection time and journal snapshot time separately.
The JSON is written atomically. Keep the report and generated previews inside the project.
The default JSON path is `.kady/geo/figure-checks/<sha256>.json`; previews in that directory
are named `<sha256>-cvd-{deuteranopia,protanopia,tritanopia}.png`.

- Pixel size: decoded raster dimensions. DPI is pixels / final inches, never the saved DPI tag.
  Without a verified target width it is unmeasured. Half-dpi rounding tolerance accommodates
  integer pixel dimensions. Without an explicit artwork class, a result below every known
  floor fails; below only some floors warns; unknown classes never establish a pass.
- Minimum text: simple SVG presentation attributes/inline styles with inherited transforms,
  or PDF live text with its text/current transformation matrices and page UserUnit. External
  CSS, nested SVG viewports, textPath/use, outlined text and complex PDF Form layouts are not
  a complete text measurement; partial measurements warn rather than establish a pass.
  Raster text is unmeasured unless the Matplotlib exporter embedded `gaid.figure` JSON
  (`pixelSize: [w,h]`, `widthMm`, `minFontPt`) matching the raster dimensions. That is source
  metadata, not OCR, and cannot prove the absence of smaller text baked into an image.
- PDF font programs: page font resources (including descendant fonts and Type3 programs).
  Nested Form resources are not certified. EPS: DSC declared fonts compared to font resource
  blocks. Live SVG text references are treated as unembedded; outlined SVG is unmeasured,
  not evidence of editability. No journal compliance or complete font coverage is implied.
- Vector containers have no single pixel size or DPI. Their embedded raster DPI is unmeasured;
  inspect any raster source at its placement size manually. No renderer is installed by this
  skill. Check the raster companion for colour ramps and CVD. PDF metadata needs `pypdf`;
  without it, PDF-specific checks stay unmeasured rather than blocking all checks.
- Colour map: sampled saturated pixels forming a long, mostly monotonic blue-to-red hue ramp
  produce a **warning**, never a failure. False positives/negatives are possible; no finding
  does not identify or validate a palette. Categorical hues can be intentional.
- CVD: raster sRGB composited on white, downsampled to at most 1400×1400, then transformed
  in **linear** sRGB using the Machado 2009 severity-1 matrices. Three PNGs next to the JSON
  illustrate protanopia, deuteranopia and tritanopia. Their presence warns for manual review;
  it does not establish readability. Colour-managed print/CMYK behaviour is not simulated.
- Axis units and panel labels require human review; always unmeasured. File format uses the
  profile's known allow-list; an empty list means unknown, not unrestricted. AI policy follows
  the declared kind/use and the dated profile, not image-content detection. `image-edit` rules
  may be conservative for primary research images; read profile notes and the actual policy.

Run with the project environment or GAID helper environment (NumPy, Pillow, Matplotlib,
pypdf). Exit codes: 0 = result written (may contain fail findings); 3 = dependency missing;
4 = file not found; 5 = invalid input/option/value; 1 = other execution error. Figure size is
bounded to 64 MiB/40 million raster pixels, SVG to 100,000 elements, PDF to 20 pages. These
bounds limit inspection; they do not alter the figure.
