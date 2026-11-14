//! The agent's face, rasterised so a notification can carry it.
//!
//! A banner cannot be handed an SVG: `set_image` takes a path to a gif, jpg
//! or png. The app draws its faces from inline SVG tinted by a CSS variable,
//! so nothing on disk exists to hand the operating system and this is what
//! produces it.
//!
//! Each source carries exactly one fill, painted through a luminance mask,
//! which is why one asset serves all six colours: substituting that single
//! string is the whole of the tint. The eyes are black inside the mask, so
//! they are holes rather than ink, and the raster has to keep its alpha or a
//! banner in dark mode shows a face with white eyes.

use std::path::PathBuf;

use resvg::tiny_skia;
use resvg::usvg;

/// The fill every source carries, and the only thing a tint replaces.
const SOURCE_FILL: &str = "fill=\"#006239\"";

/// 3x of a 128pt thumbnail, which is the largest macOS draws an attachment at.
const SIZE: u32 = 384;

/// The viewBox every face is authored in.
const VIEWBOX: f32 = 512.0;

/// The face colours, resolved from the oklch the app paints with.
///
/// The light values deliberately: a banner is a fixed bitmap drawn on
/// whichever appearance is active, and the dark ramp washes out on a light
/// banner while these hold on both.
const COLOURS: &[(&str, &str)] = &[
    ("ops", "#228d64"),
    ("scout", "#c7773b"),
    ("post", "#8b6cbe"),
    ("mail", "#4e82c3"),
    ("house", "#b39a37"),
    ("watch", "#c55f62"),
];

/// The silhouettes, each in the three expressions a notification can mean.
///
/// Embedded rather than bundled as resources: twenty one files of about a
/// kilobyte travel inside the binary for less than the cost of resolving a
/// resource directory at runtime.
const SOURCES: &[(&str, &str, &str)] = &[
    (
        "squircle",
        "idle",
        include_str!("../../src/assets/herbie-motion/static/squircle/idle.svg"),
    ),
    (
        "squircle",
        "input-needed",
        include_str!("../../src/assets/herbie-motion/static/squircle/input-needed.svg"),
    ),
    (
        "squircle",
        "error",
        include_str!("../../src/assets/herbie-motion/static/squircle/error.svg"),
    ),
    (
        "circle",
        "idle",
        include_str!("../../src/assets/herbie-motion/static/circle/idle.svg"),
    ),
    (
        "circle",
        "input-needed",
        include_str!("../../src/assets/herbie-motion/static/circle/input-needed.svg"),
    ),
    (
        "circle",
        "error",
        include_str!("../../src/assets/herbie-motion/static/circle/error.svg"),
    ),
    (
        "soft-hexagon",
        "idle",
        include_str!("../../src/assets/herbie-motion/static/soft-hexagon/idle.svg"),
    ),
    (
        "soft-hexagon",
        "input-needed",
        include_str!("../../src/assets/herbie-motion/static/soft-hexagon/input-needed.svg"),
    ),
    (
        "soft-hexagon",
        "error",
        include_str!("../../src/assets/herbie-motion/static/soft-hexagon/error.svg"),
    ),
    (
        "pill",
        "idle",
        include_str!("../../src/assets/herbie-motion/static/pill/idle.svg"),
    ),
    (
        "pill",
        "input-needed",
        include_str!("../../src/assets/herbie-motion/static/pill/input-needed.svg"),
    ),
    (
        "pill",
        "error",
        include_str!("../../src/assets/herbie-motion/static/pill/error.svg"),
    ),
    (
        "rounded-diamond",
        "idle",
        include_str!("../../src/assets/herbie-motion/static/rounded-diamond/idle.svg"),
    ),
    (
        "rounded-diamond",
        "input-needed",
        include_str!("../../src/assets/herbie-motion/static/rounded-diamond/input-needed.svg"),
    ),
    (
        "rounded-diamond",
        "error",
        include_str!("../../src/assets/herbie-motion/static/rounded-diamond/error.svg"),
    ),
    (
        "soft-trapezoid",
        "idle",
        include_str!("../../src/assets/herbie-motion/static/soft-trapezoid/idle.svg"),
    ),
    (
        "soft-trapezoid",
        "input-needed",
        include_str!("../../src/assets/herbie-motion/static/soft-trapezoid/input-needed.svg"),
    ),
    (
        "soft-trapezoid",
        "error",
        include_str!("../../src/assets/herbie-motion/static/soft-trapezoid/error.svg"),
    ),
    (
        "rounded-arch",
        "idle",
        include_str!("../../src/assets/herbie-motion/static/rounded-arch/idle.svg"),
    ),
    (
        "rounded-arch",
        "input-needed",
        include_str!("../../src/assets/herbie-motion/static/rounded-arch/input-needed.svg"),
    ),
    (
        "rounded-arch",
        "error",
        include_str!("../../src/assets/herbie-motion/static/rounded-arch/error.svg"),
    ),
];

/// The shape an agent saved, falling back the way the app's own component does.
fn source(shape: &str, expression: &str) -> &'static str {
    SOURCES
        .iter()
        .find(|(s, e, _)| *s == shape && *e == expression)
        .or_else(|| {
            SOURCES
                .iter()
                .find(|(s, e, _)| *s == "squircle" && *e == expression)
        })
        .map(|(_, _, svg)| *svg)
        .unwrap_or(SOURCES[0].2)
}

fn colour(name: &str) -> &'static str {
    COLOURS
        .iter()
        .find(|(key, _)| *key == name)
        .map(|(_, hex)| *hex)
        .unwrap_or(COLOURS[0].1)
}

fn is_dev() -> bool {
    cfg!(debug_assertions) || std::env::var("HERBIE_DEV").is_ok_and(|value| value == "1")
}

/// Where Herbie keeps its state, resolved the way the sidecar resolves it.
///
/// Duplicated rather than asked for, because the two processes are configured
/// separately and a cache written into the other install's directory would be
/// a cache nothing ever reads.
fn state_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os("HERBIE_STATE_DIR") {
        if !dir.is_empty() {
            return PathBuf::from(dir);
        }
    }
    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_default();
    home.join(if is_dev() { ".herbie-dev" } else { ".herbie" })
}

fn rasterise(shape: &str, colour_name: &str, expression: &str) -> Result<tiny_skia::Pixmap, String> {
    let svg = source(shape, expression);
    // A source that stopped carrying exactly one fill would tint silently
    // wrong, so the count is checked rather than assumed.
    if svg.matches(SOURCE_FILL).count() != 1 {
        return Err(format!(
            "expected one fill in the {shape} {expression} face, found {}",
            svg.matches(SOURCE_FILL).count()
        ));
    }
    let tinted = svg.replace(SOURCE_FILL, &format!("fill=\"{}\"", colour(colour_name)));

    let tree = usvg::Tree::from_str(&tinted, &usvg::Options::default())
        .map_err(|cause| format!("the {shape} {expression} face would not parse: {cause}"))?;
    let mut pixmap =
        tiny_skia::Pixmap::new(SIZE, SIZE).ok_or_else(|| "the pixmap would not allocate".to_string())?;
    let scale = SIZE as f32 / VIEWBOX;
    resvg::render(
        &tree,
        tiny_skia::Transform::from_scale(scale, scale),
        &mut pixmap.as_mut(),
    );
    Ok(pixmap)
}

/// The path to this face as a png, rasterising it the first time it is asked for.
///
/// Deterministic output, so a hit is reused forever and the cache only needs
/// clearing when the assets themselves change.
pub fn face_png(shape: &str, colour_name: &str, expression: &str) -> Result<PathBuf, String> {
    let dir = state_dir().join("faces");
    let path = dir.join(format!("{shape}-{colour_name}-{expression}@3x.png"));
    if path.is_file() {
        return Ok(path);
    }

    let pixmap = rasterise(shape, colour_name, expression)?;
    let png = pixmap
        .encode_png()
        .map_err(|cause| format!("the face would not encode: {cause}"))?;
    std::fs::create_dir_all(&dir)
        .map_err(|cause| format!("the face cache would not open: {cause}"))?;
    std::fs::write(&path, png).map_err(|cause| format!("the face would not save: {cause}"))?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Eye centres, from the viewBox every face shares.
    const EYE: (f32, f32) = (186.0, 282.0);

    fn at(pixmap: &tiny_skia::Pixmap, x: u32, y: u32) -> tiny_skia::PremultipliedColorU8 {
        pixmap.pixels()[(y * pixmap.width() + x) as usize]
    }

    #[test]
    fn every_face_rasterises() {
        for (shape, expression, _) in SOURCES {
            let pixmap = rasterise(shape, "scout", expression).expect("the face should rasterise");
            assert_eq!(pixmap.width(), SIZE);
            assert_eq!(pixmap.height(), SIZE);
            assert!(
                pixmap.pixels().iter().any(|pixel| pixel.alpha() > 0),
                "the {shape} {expression} face came out blank"
            );
        }
    }

    #[test]
    fn the_body_takes_the_agent_colour() {
        let pixmap = rasterise("circle", "scout", "idle").expect("the face should rasterise");
        // Between the eyes, which is body on every silhouette.
        let centre = at(&pixmap, SIZE / 2, (282.0 / VIEWBOX * SIZE as f32) as u32);
        assert_eq!(centre.alpha(), 255, "the body should be opaque");
        assert_eq!(
            (centre.red(), centre.green(), centre.blue()),
            (0xc7, 0x77, 0x3b),
            "the body should carry the agent colour"
        );
    }

    /// The one that catches a lost alpha channel.
    ///
    /// The eyes are black inside a luminance mask, so they are cut out of the
    /// shape. If resvg ever stopped honouring the mask, or the png were
    /// flattened onto a background, this is the assertion that would fail
    /// rather than a banner quietly growing white eyes in dark mode.
    #[test]
    fn the_eyes_are_holes() {
        let pixmap = rasterise("circle", "scout", "idle").expect("the face should rasterise");
        let x = (EYE.0 / VIEWBOX * SIZE as f32) as u32;
        let y = (EYE.1 / VIEWBOX * SIZE as f32) as u32;
        assert_eq!(
            at(&pixmap, x, y).alpha(),
            0,
            "the eye should be fully transparent"
        );
    }

    #[test]
    fn an_unknown_shape_falls_back_without_losing_the_expression() {
        let known = source("squircle", "error");
        assert_eq!(source("not-a-shape", "error"), known);
    }

    #[test]
    fn an_unknown_colour_falls_back_to_the_first() {
        assert_eq!(colour("not-a-colour"), colour("ops"));
    }
}

