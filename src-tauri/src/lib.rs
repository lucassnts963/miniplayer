use tauri::{AppHandle, Manager, LogicalSize, Emitter, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct PlaylistItem {
    pub id: String,
    pub title: String,
    pub url: String,
    pub thumbnail: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct PlaylistResult {
    pub id: String,
    pub title: Option<String>,
    pub items: Vec<PlaylistItem>,
}

fn extract_playlist_id(input: &str) -> Option<String> {
    let trimmed = input.trim();
    if let Ok(url) = tauri::Url::parse(trimmed) {
        for (k, v) in url.query_pairs() {
            if k == "list" {
                return Some(v.to_string());
            }
        }
    }
    if let Ok(re) = regex::Regex::new(r"[?&]list=([a-zA-Z0-9_-]+)") {
        if let Some(caps) = re.captures(trimmed) {
            return Some(caps[1].to_string());
        }
    }
    if (trimmed.starts_with("PL") || trimmed.starts_with("RD") || trimmed.starts_with("UU") || trimmed.starts_with("LL") || trimmed.starts_with("OLAK"))
        && trimmed.len() >= 10 {
        return Some(trimmed.to_string());
    }
    None
}

fn fetch_playlist_internal(playlist_input: &str) -> Result<PlaylistResult, String> {
    let playlist_id = extract_playlist_id(playlist_input)
        .ok_or_else(|| "ID ou link de playlist inválido".to_string())?;

    let url = format!("https://www.youtube.com/playlist?list={}", playlist_id);

    let client = reqwest::blocking::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .header("Accept-Language", "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7")
        .header("Cookie", "SOCS=CAESEwgDEgk2OTI2MDIwOTQaAnB0IAEaBgoECAIQAg")
        .send()
        .map_err(|e| format!("Erro de rede ao buscar playlist: {}", e))?;
    let html = response.text().map_err(|e| format!("Erro ao ler resposta da playlist: {}", e))?;

    // Extrair JSON ytInitialData de forma flexível
    let marker = if let Some(idx) = html.find("var ytInitialData = ") {
        Some((idx, "var ytInitialData = ".len()))
    } else if let Some(idx) = html.find("window[\"ytInitialData\"] = ") {
        Some((idx, "window[\"ytInitialData\"] = ".len()))
    } else if let Some(idx) = html.find("ytInitialData = ") {
        Some((idx, "ytInitialData = ".len()))
    } else {
        None
    };

    let json_str = if let Some((start_idx, prefix_len)) = marker {
        let after = &html[start_idx + prefix_len..];
        if let Some(end_idx) = after.find(";</script>") {
            &after[..end_idx]
        } else if let Some(end_idx) = after.find("</script>") {
            let chunk = after[..end_idx].trim_end();
            if chunk.ends_with(';') {
                &chunk[..chunk.len() - 1]
            } else {
                chunk
            }
        } else {
            return Err("Estrutura da página de playlist do YouTube mudou".into());
        }
    } else {
        return Err("Não foi possível encontrar dados da playlist no YouTube".into());
    };

    let data: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| format!("Erro ao processar JSON da playlist: {}", e))?;

    // Título da playlist
    let playlist_title = data
        .pointer("/header/playlistHeaderRenderer/title/simpleText")
        .and_then(|v| v.as_str())
        .or_else(|| data.pointer("/metadata/playlistMetadataRenderer/title").and_then(|v| v.as_str()))
        .map(|s| s.to_string());

    let mut items: Vec<PlaylistItem> = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();

    // Tentar Formato 1: modern lockupViewModel
    if let Some(contents) = data
        .pointer("/contents/twoColumnBrowseResultsRenderer/tabs/0/tabRenderer/content/sectionListRenderer/contents/0/itemSectionRenderer/contents")
        .and_then(|v| v.as_array())
    {
        for entry in contents {
            if let Some(vm) = entry.get("lockupViewModel") {
                if let Some(id) = vm.get("contentId").and_then(|v| v.as_str()) {
                    if !seen_ids.insert(id.to_string()) {
                        continue;
                    }
                    let title = vm
                        .pointer("/metadata/lockupMetadataViewModel/title/content")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Vídeo do YouTube")
                        .to_string();

                    items.push(PlaylistItem {
                        id: id.to_string(),
                        title,
                        url: format!("https://www.youtube.com/watch?v={}", id),
                        thumbnail: format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", id),
                    });
                }
            } else if let Some(pvr) = entry.get("playlistVideoRenderer") {
                if let Some(id) = pvr.get("videoId").and_then(|v| v.as_str()) {
                    if !seen_ids.insert(id.to_string()) {
                        continue;
                    }
                    let title = pvr
                        .pointer("/title/runs/0/text")
                        .and_then(|v| v.as_str())
                        .or_else(|| pvr.pointer("/title/simpleText").and_then(|v| v.as_str()))
                        .unwrap_or("Vídeo do YouTube")
                        .to_string();

                    items.push(PlaylistItem {
                        id: id.to_string(),
                        title,
                        url: format!("https://www.youtube.com/watch?v={}", id),
                        thumbnail: format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", id),
                    });
                }
            }
        }
    }

    // Tentar Formato 2: playlistVideoListRenderer
    if items.is_empty() {
        if let Some(contents) = data
            .pointer("/contents/twoColumnBrowseResultsRenderer/tabs/0/tabRenderer/content/sectionListRenderer/contents/0/itemSectionRenderer/contents/0/playlistVideoListRenderer/contents")
            .and_then(|v| v.as_array())
        {
            for entry in contents {
                if let Some(pvr) = entry.get("playlistVideoRenderer") {
                    if let Some(id) = pvr.get("videoId").and_then(|v| v.as_str()) {
                        if !seen_ids.insert(id.to_string()) {
                            continue;
                        }
                        let title = pvr
                            .pointer("/title/runs/0/text")
                            .and_then(|v| v.as_str())
                            .or_else(|| pvr.pointer("/title/simpleText").and_then(|v| v.as_str()))
                            .unwrap_or("Vídeo do YouTube")
                            .to_string();

                        items.push(PlaylistItem {
                            id: id.to_string(),
                            title,
                            url: format!("https://www.youtube.com/watch?v={}", id),
                            thumbnail: format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", id),
                        });
                    }
                }
            }
        }
    }

    if items.is_empty() {
        return Err("Nenhum vídeo encontrado nesta playlist ou a playlist é privada/vazia".into());
    }

    Ok(PlaylistResult {
        id: playlist_id,
        title: playlist_title,
        items,
    })
}

#[tauri::command]
fn fetch_youtube_playlist(playlist_url_or_id: String) -> Result<PlaylistResult, String> {
    fetch_playlist_internal(&playlist_url_or_id)
}

fn import_cookies_internal(app: &AppHandle, browser: Option<String>) -> Result<(usize, &'static str), String> {
    let window = app.get_webview_window("main").ok_or("Janela principal não encontrada")?;
    let domains = Some(vec!["youtube.com".to_string(), "google.com".to_string()]);

    let (cookies, source_name) = match browser.as_deref() {
        Some("firefox") => (
            rookie::firefox(domains).map_err(|e| format!("Firefox: {}", e))?,
            "Firefox",
        ),
        Some("chrome") => (
            rookie::chrome(domains).map_err(|e| format!("Chrome: {}", e))?,
            "Chrome",
        ),
        Some("edge") => (
            rookie::edge(domains).map_err(|e| format!("Edge: {}", e))?,
            "Edge",
        ),
        _ => {
            // Tenta Firefox primeiro (mais confiável e desbloqueado no Windows)
            if let Ok(c) = rookie::firefox(domains.clone()) {
                if !c.is_empty() {
                    (c, "Firefox")
                } else if let Ok(c_edge) = rookie::edge(domains.clone()) {
                    (c_edge, "Edge")
                } else if let Ok(c_chrome) = rookie::chrome(domains.clone()) {
                    (c_chrome, "Chrome")
                } else {
                    return Err("Nenhum cookie encontrado nos navegadores instalados".into());
                }
            } else if let Ok(c_edge) = rookie::edge(domains.clone()) {
                (c_edge, "Edge")
            } else if let Ok(c_chrome) = rookie::chrome(domains.clone()) {
                (c_chrome, "Chrome")
            } else {
                return Err("Nenhum navegador com cookies do YouTube encontrado".into());
            }
        }
    };

    let mut count = 0;
    for c in &cookies {
        if c.domain.contains("youtube") || c.domain.contains("google") {
            let cookie = tauri::webview::Cookie::build((c.name.as_str(), c.value.as_str()))
                .domain(c.domain.as_str())
                .path(if c.path.is_empty() { "/" } else { c.path.as_str() })
                .secure(c.secure)
                .http_only(c.http_only)
                .build();
            if window.set_cookie(cookie).is_ok() {
                count += 1;
            }
        }
    }

    Ok((count, source_name))
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct BrowserAuthInfo {
    pub browser: String,
    pub has_session: bool,
    pub cookie_count: usize,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct AuthStatusResponse {
    pub is_logged_in: bool,
    pub active_browser: Option<String>,
    pub detected_browsers: Vec<BrowserAuthInfo>,
}

#[tauri::command]
fn check_youtube_auth() -> Result<AuthStatusResponse, String> {
    let domains = Some(vec!["youtube.com".to_string(), "google.com".to_string()]);
    let mut detected = Vec::new();
    let mut is_logged_in = false;
    let mut active_browser = None;

    // 1. Firefox
    if let Ok(cookies) = rookie::firefox(domains.clone()) {
        let has_login = cookies.iter().any(|c| {
            c.name == "LOGIN_INFO" || c.name == "SID" || c.name == "SAPISID" || c.name == "SSID"
        });
        if has_login {
            is_logged_in = true;
            if active_browser.is_none() {
                active_browser = Some("Firefox".to_string());
            }
        }
        detected.push(BrowserAuthInfo {
            browser: "Firefox".to_string(),
            has_session: has_login,
            cookie_count: cookies.len(),
        });
    }

    // 2. Edge
    if let Ok(cookies) = rookie::edge(domains.clone()) {
        let has_login = cookies.iter().any(|c| {
            c.name == "LOGIN_INFO" || c.name == "SID" || c.name == "SAPISID" || c.name == "SSID"
        });
        if has_login {
            is_logged_in = true;
            if active_browser.is_none() {
                active_browser = Some("Edge".to_string());
            }
        }
        detected.push(BrowserAuthInfo {
            browser: "Edge".to_string(),
            has_session: has_login,
            cookie_count: cookies.len(),
        });
    }

    // 3. Chrome
    if let Ok(cookies) = rookie::chrome(domains.clone()) {
        let has_login = cookies.iter().any(|c| {
            c.name == "LOGIN_INFO" || c.name == "SID" || c.name == "SAPISID" || c.name == "SSID"
        });
        if has_login {
            is_logged_in = true;
            if active_browser.is_none() {
                active_browser = Some("Chrome".to_string());
            }
        }
        detected.push(BrowserAuthInfo {
            browser: "Chrome".to_string(),
            has_session: has_login,
            cookie_count: cookies.len(),
        });
    }

    Ok(AuthStatusResponse {
        is_logged_in,
        active_browser,
        detected_browsers: detected,
    })
}

#[tauri::command]
fn import_browser_cookies(app: AppHandle, browser: Option<String>) -> Result<String, String> {
    let (count, source) = import_cookies_internal(&app, browser)?;
    let msg = format!("{} cookies importados do {}", count, source);
    let _ = app.emit("cookies-imported", serde_json::json!({
        "count": count,
        "source": source,
        "message": msg.clone()
    }));
    Ok(msg)
}

#[tauri::command]
fn open_auth_window(app: AppHandle) -> Result<(), String> {
    if let Some(auth_win) = app.get_webview_window("auth") {
        let _ = auth_win.center();
        auth_win.show().map_err(|e| e.to_string())?;
        auth_win.set_focus().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Janela de autenticação não encontrada".into())
    }
}

#[tauri::command]
fn close_auth_window(app: AppHandle) -> Result<(), String> {
    if let Some(auth_win) = app.get_webview_window("auth") {
        auth_win.hide().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Janela de autenticação não encontrada".into())
    }
}

#[tauri::command]
fn open_youtube_login(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("youtube-login") {
        let _ = existing.show();
        let _ = existing.unminimize();
        let _ = existing.set_focus();
        return Ok(());
    }

    let url: Url = "https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com"
        .parse()
        .map_err(|e| format!("Erro de URL: {:?}", e))?;

    let win = WebviewWindowBuilder::new(
        &app,
        "youtube-login",
        WebviewUrl::External(url),
    )
    .title("Conectar Conta Google / YouTube")
    .inner_size(580.0, 780.0)
    .min_inner_size(480.0, 600.0)
    .decorations(true)
    .resizable(true)
    .always_on_top(true)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    let _ = win.show();
    let _ = win.set_focus();

    Ok(())
}

#[tauri::command]
fn toggle_player_visibility(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().map_err(|e| e.to_string())?;
        if is_visible {
            window.hide().map_err(|e| e.to_string())?;
            Ok(false)
        } else {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
            Ok(true)
        }
    } else {
        Err("Janela principal não encontrada".into())
    }
}

#[tauri::command]
fn toggle_always_on_top(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        let current = window.is_always_on_top().map_err(|e| e.to_string())?;
        let next = !current;
        window.set_always_on_top(next).map_err(|e| e.to_string())?;
        Ok(next)
    } else {
        Err("Janela principal não encontrada".into())
    }
}

#[tauri::command]
fn get_always_on_top(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        window.is_always_on_top().map_err(|e| e.to_string())
    } else {
        Err("Janela principal não encontrada".into())
    }
}

#[tauri::command]
fn open_quick_add(app: AppHandle) -> Result<(), String> {
    if let Some(quick_win) = app.get_webview_window("quick-add") {
        // Tenta posicionar próximo à janela principal se estiver visível
        if let Some(main_win) = app.get_webview_window("main") {
            if main_win.is_visible().unwrap_or(false) {
                if let (Ok(main_pos), Ok(main_size), Ok(quick_size)) = (
                    main_win.outer_position(),
                    main_win.outer_size(),
                    quick_win.outer_size(),
                ) {
                    // Posiciona logo acima da janela principal ou centralizado horizontalmente com ela
                    let x = main_pos.x + (main_size.width as i32 - quick_size.width as i32) / 2;
                    let y = (main_pos.y - quick_size.height as i32 - 12).max(40);
                    let _ = quick_win.set_position(tauri::PhysicalPosition::new(x, y));
                }
            } else {
                let _ = quick_win.center();
            }
        }
        quick_win.show().map_err(|e| e.to_string())?;
        quick_win.set_focus().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Janela de adição rápida não encontrada".into())
    }
}

#[tauri::command]
fn close_quick_add(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("quick-add") {
        window.hide().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Janela de adição rápida não encontrada".into())
    }
}

#[cfg(target_os = "windows")]
mod win_native {
    use std::ffi::c_void;
    use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};

    #[repr(C)]
    struct RECT {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    const GWLP_WNDPROC: i32 = -4;
    const GCLP_HBRBACKGROUND: i32 = -10;
    const BLACK_BRUSH: i32 = 4;
    const WM_SIZE: u32 = 0x0005;
    const WM_ERASEBKGND: u32 = 0x0014;
    const WM_NCLBUTTONDOWN: u32 = 0x00A1;
    const WM_SIZING: u32 = 0x0214;
    const GW_CHILD: u32 = 5;
    const SWP_NOZORDER: u32 = 0x0004;
    const SWP_NOACTIVATE: u32 = 0x0010;
    const SWP_NOCOPYBITS: u32 = 0x0100;
    const HTLEFT: usize = 10;
    const HTRIGHT: usize = 11;
    const HTTOP: usize = 12;
    const HTTOPLEFT: usize = 13;
    const HTTOPRIGHT: usize = 14;
    const HTBOTTOM: usize = 15;
    const HTBOTTOMLEFT: usize = 16;
    const HTBOTTOMRIGHT: usize = 17;
    const WMSZ_LEFT: usize = 1;
    const WMSZ_RIGHT: usize = 2;
    const WMSZ_TOP: usize = 3;
    const WMSZ_TOPLEFT: usize = 4;
    const WMSZ_TOPRIGHT: usize = 5;
    const WMSZ_BOTTOM: usize = 6;
    const WMSZ_BOTTOMLEFT: usize = 7;
    const WMSZ_BOTTOMRIGHT: usize = 8;

    const DWMWA_WINDOW_CORNER_PREFERENCE: u32 = 33;
    const DWMWCP_ROUND: u32 = 2;
    const DWMWA_BORDER_COLOR: u32 = 34;
    const DWMWA_COLOR_NONE: u32 = 0xFFFFFFFE;

    const ASPECT_RATIO: f64 = 16.0 / 9.0;
    const MIN_W: i32 = 288;
    const MIN_H: i32 = 162;

    static PREV_WNDPROC: AtomicIsize = AtomicIsize::new(0);
    static PREV_CHILD_WNDPROC: AtomicIsize = AtomicIsize::new(0);
    pub static IS_FULLSCREEN: AtomicBool = AtomicBool::new(false);

    type WndProc = unsafe extern "system" fn(
        hwnd: *mut c_void,
        msg: u32,
        wparam: usize,
        lparam: isize,
    ) -> isize;

    type EnumChildProc = unsafe extern "system" fn(hwnd: *mut c_void, lparam: isize) -> i32;

    #[link(name = "user32")]
    unsafe extern "system" {
        fn SetWindowLongPtrW(hwnd: *mut c_void, index: i32, new_long: isize) -> isize;
        fn SetClassLongPtrW(hwnd: *mut c_void, index: i32, new_long: isize) -> usize;
        fn CallWindowProcW(
            prev_wnd_func: WndProc,
            hwnd: *mut c_void,
            msg: u32,
            wparam: usize,
            lparam: isize,
        ) -> isize;
        fn GetClientRect(hwnd: *mut c_void, lp_rect: *mut RECT) -> i32;
        fn FillRect(hdc: *mut c_void, lprc: *const RECT, hbr: *mut c_void) -> i32;
        fn EnumChildWindows(hwnd_parent: *mut c_void, lp_enum_func: EnumChildProc, lparam: isize) -> i32;
        fn GetWindow(hwnd: *mut c_void, u_cmd: u32) -> *mut c_void;
        fn SetWindowPos(
            hwnd: *mut c_void,
            hwnd_insert_after: *mut c_void,
            x: i32,
            y: i32,
            cx: i32,
            cy: i32,
            u_flags: u32,
        ) -> i32;
        fn ReleaseCapture() -> i32;
        fn PostMessageW(hwnd: *mut c_void, msg: u32, wparam: usize, lparam: isize) -> i32;
    }

    #[link(name = "gdi32")]
    unsafe extern "system" {
        fn GetStockObject(i: i32) -> *mut c_void;
    }

    #[link(name = "dwmapi")]
    unsafe extern "system" {
        fn DwmSetWindowAttribute(
            hwnd: *mut c_void,
            dw_attribute: u32,
            pv_attribute: *const c_void,
            cb_attribute: u32,
        ) -> i32;
    }

    unsafe extern "system" fn set_child_black_brush(child_hwnd: *mut c_void, _lparam: isize) -> i32 {
        unsafe {
            let black_brush = GetStockObject(BLACK_BRUSH);
            let _ = SetClassLongPtrW(child_hwnd, GCLP_HBRBACKGROUND, black_brush as isize);
        }
        1
    }

    pub fn start_resize(window: &tauri::WebviewWindow, direction: &str) -> Result<(), String> {
        let ht = match direction {
            "North" | "n" => HTTOP,
            "South" | "s" => HTBOTTOM,
            "East" | "e" => HTRIGHT,
            "West" | "w" => HTLEFT,
            "NorthEast" | "ne" => HTTOPRIGHT,
            "NorthWest" | "nw" => HTTOPLEFT,
            "SouthEast" | "se" => HTBOTTOMRIGHT,
            "SouthWest" | "sw" => HTBOTTOMLEFT,
            _ => return Err("Direção inválida".into()),
        };
        let hwnd = window.hwnd().map_err(|e| e.to_string())?;
        let raw_hwnd = hwnd.0 as *mut c_void;
        unsafe {
            let _ = EnumChildWindows(raw_hwnd, set_child_black_brush, 0);
            let _ = ReleaseCapture();
            let _ = PostMessageW(raw_hwnd, WM_NCLBUTTONDOWN, ht, 0);
        }
        Ok(())
    }

    fn apply_aspect_to_rect(rect: &mut RECT, wparam: usize) {
        let raw_w = (rect.right - rect.left).max(MIN_W);
        let raw_h = (rect.bottom - rect.top).max(MIN_H);

        let (mut new_w, mut new_h) = match wparam {
            WMSZ_LEFT | WMSZ_RIGHT => {
                let w = raw_w;
                let h = ((w as f64) / ASPECT_RATIO).round() as i32;
                (w, h)
            }
            WMSZ_TOP | WMSZ_BOTTOM => {
                let h = raw_h;
                let w = ((h as f64) * ASPECT_RATIO).round() as i32;
                (w, h)
            }
            WMSZ_TOPLEFT | WMSZ_TOPRIGHT | WMSZ_BOTTOMLEFT | WMSZ_BOTTOMRIGHT => {
                // Projeção contínua sem oscilação entre largura e altura
                let target_w = ((raw_w as f64) + (raw_h as f64) * ASPECT_RATIO) * 0.5;
                let w = target_w.round() as i32;
                let h = (target_w / ASPECT_RATIO).round() as i32;
                (w, h)
            }
            _ => (raw_w, ((raw_w as f64) / ASPECT_RATIO).round() as i32),
        };

        if new_w < MIN_W || new_h < MIN_H {
            new_w = MIN_W;
            new_h = MIN_H;
        }

        match wparam {
            WMSZ_LEFT => {
                rect.left = rect.right - new_w;
                rect.bottom = rect.top + new_h;
            }
            WMSZ_RIGHT => {
                rect.right = rect.left + new_w;
                rect.bottom = rect.top + new_h;
            }
            WMSZ_TOP => {
                rect.top = rect.bottom - new_h;
                rect.left = rect.right - new_w;
            }
            WMSZ_BOTTOM => {
                rect.bottom = rect.top + new_h;
                rect.left = rect.right - new_w;
            }
            WMSZ_TOPLEFT => {
                rect.left = rect.right - new_w;
                rect.top = rect.bottom - new_h;
            }
            WMSZ_TOPRIGHT => {
                rect.right = rect.left + new_w;
                rect.top = rect.bottom - new_h;
            }
            WMSZ_BOTTOMLEFT => {
                rect.left = rect.right - new_w;
                rect.bottom = rect.top + new_h;
            }
            WMSZ_BOTTOMRIGHT | _ => {
                rect.right = rect.left + new_w;
                rect.bottom = rect.top + new_h;
            }
        }
    }

    unsafe extern "system" fn aspect_wndproc(
        hwnd: *mut c_void,
        msg: u32,
        wparam: usize,
        lparam: isize,
    ) -> isize {
        let prev_ptr = PREV_WNDPROC.load(Ordering::Relaxed);
        if prev_ptr == 0 {
            return 0;
        }
        let prev: WndProc = unsafe { std::mem::transmute(prev_ptr) };

        if msg == WM_ERASEBKGND {
            unsafe {
                let mut rc = RECT { left: 0, top: 0, right: 0, bottom: 0 };
                if GetClientRect(hwnd, &mut rc) != 0 && wparam != 0 {
                    let black_brush = GetStockObject(BLACK_BRUSH);
                    let _ = FillRect(wparam as *mut c_void, &rc, black_brush);
                }
            }
            return 1;
        }

        if msg == WM_SIZE {
            let width = (lparam & 0xFFFF) as i32;
            let height = ((lparam >> 16) & 0xFFFF) as i32;
            if width > 0 && height > 0 {
                unsafe {
                    let child = GetWindow(hwnd, GW_CHILD);
                    if !child.is_null() {
                        let _ = SetWindowPos(
                            child,
                            std::ptr::null_mut(),
                            0,
                            0,
                            width,
                            height,
                            SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOCOPYBITS,
                        );
                    }
                }
            }
        }

        if msg == WM_SIZING && !IS_FULLSCREEN.load(Ordering::Relaxed) && lparam != 0 {
            let rect = unsafe { &mut *(lparam as *mut RECT) };
            apply_aspect_to_rect(rect, wparam);
            return 1;
        }

        unsafe { CallWindowProcW(prev, hwnd, msg, wparam, lparam) }
    }

    unsafe extern "system" fn child_wndproc(
        hwnd: *mut c_void,
        msg: u32,
        wparam: usize,
        lparam: isize,
    ) -> isize {
        let prev_ptr = PREV_CHILD_WNDPROC.load(Ordering::Relaxed);
        if prev_ptr == 0 {
            return 0;
        }
        let prev: WndProc = unsafe { std::mem::transmute(prev_ptr) };

        if msg == WM_ERASEBKGND {
            unsafe {
                let mut rc = RECT { left: 0, top: 0, right: 0, bottom: 0 };
                if GetClientRect(hwnd, &mut rc) != 0 && wparam != 0 {
                    let black_brush = GetStockObject(BLACK_BRUSH);
                    let _ = FillRect(wparam as *mut c_void, &rc, black_brush);
                }
            }
            return 1;
        }

        unsafe { CallWindowProcW(prev, hwnd, msg, wparam, lparam) }
    }

    pub fn install_window_hooks(window: &tauri::WebviewWindow) {
        let _ = window.set_background_color(Some(tauri::window::Color(0, 0, 0, 255)));
        if let Ok(hwnd) = window.hwnd() {
            let raw_hwnd = hwnd.0 as *mut c_void;
            unsafe {
                // Define fundo preto nativo (BLACK_BRUSH) na janela principal e todas as janelas filhas (WebView2)
                let black_brush = GetStockObject(BLACK_BRUSH);
                let _ = SetClassLongPtrW(raw_hwnd, GCLP_HBRBACKGROUND, black_brush as isize);
                let _ = EnumChildWindows(raw_hwnd, set_child_black_brush, 0);

                // Configura cantos arredondados nativos do Windows 11 e remove a borda DWM de 1px
                let corner_pref: u32 = DWMWCP_ROUND;
                let _ = DwmSetWindowAttribute(
                    raw_hwnd,
                    DWMWA_WINDOW_CORNER_PREFERENCE,
                    &corner_pref as *const u32 as *const c_void,
                    std::mem::size_of::<u32>() as u32,
                );
                let border_none: u32 = DWMWA_COLOR_NONE;
                let _ = DwmSetWindowAttribute(
                    raw_hwnd,
                    DWMWA_BORDER_COLOR,
                    &border_none as *const u32 as *const c_void,
                    std::mem::size_of::<u32>() as u32,
                );

                // Instala hook de WM_SIZING na janela principal
                if PREV_WNDPROC.load(Ordering::Relaxed) == 0 {
                    let prev = SetWindowLongPtrW(
                        raw_hwnd,
                        GWLP_WNDPROC,
                        aspect_wndproc as *const () as isize,
                    );
                    if prev != 0 {
                        PREV_WNDPROC.store(prev, Ordering::Relaxed);
                    }
                }

                // Instala hook de WM_ERASEBKGND na janela filha direta (WRY_WEBVIEW)
                let child = GetWindow(raw_hwnd, GW_CHILD);
                if !child.is_null() && PREV_CHILD_WNDPROC.load(Ordering::Relaxed) == 0 {
                    let prev_c = SetWindowLongPtrW(
                        child,
                        GWLP_WNDPROC,
                        child_wndproc as *const () as isize,
                    );
                    if prev_c != 0 {
                        PREV_CHILD_WNDPROC.store(prev_c, Ordering::Relaxed);
                    }
                }
            }
        }
    }

    pub fn apply_borderless_rounded(window: &tauri::WebviewWindow) {
        let _ = window.set_background_color(Some(tauri::window::Color(0, 0, 0, 255)));
        if let Ok(hwnd) = window.hwnd() {
            let raw_hwnd = hwnd.0 as *mut c_void;
            unsafe {
                let black_brush = GetStockObject(BLACK_BRUSH);
                let _ = SetClassLongPtrW(raw_hwnd, GCLP_HBRBACKGROUND, black_brush as isize);
                let _ = EnumChildWindows(raw_hwnd, set_child_black_brush, 0);

                let corner_pref: u32 = DWMWCP_ROUND;
                let _ = DwmSetWindowAttribute(
                    raw_hwnd,
                    DWMWA_WINDOW_CORNER_PREFERENCE,
                    &corner_pref as *const u32 as *const c_void,
                    std::mem::size_of::<u32>() as u32,
                );
                let border_none: u32 = DWMWA_COLOR_NONE;
                let _ = DwmSetWindowAttribute(
                    raw_hwnd,
                    DWMWA_BORDER_COLOR,
                    &border_none as *const u32 as *const c_void,
                    std::mem::size_of::<u32>() as u32,
                );
            }
        }
    }
}

#[tauri::command]
fn set_window_preset(app: AppHandle, preset: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let (w, h) = match preset.as_str() {
            "small" => (352.0, 198.0),
            "medium" => (448.0, 252.0),
            "large" => (640.0, 360.0),
            "xlarge" => (800.0, 450.0),
            _ => (448.0, 252.0),
        };
        let old_pos = window.outer_position().ok();
        let old_size = window.outer_size().ok();
        window.set_size(LogicalSize::new(w, h)).map_err(|e| e.to_string())?;
        if let (Some(pos), Some(old_s), Ok(new_s)) = (old_pos, old_size, window.outer_size()) {
            let right_anchor = pos.x + old_s.width as i32;
            let new_x = (right_anchor - new_s.width as i32).max(0);
            let _ = window.set_position(tauri::PhysicalPosition::new(new_x, pos.y));
        }
        Ok(())
    } else {
        Err("Janela principal não encontrada".into())
    }
}

#[tauri::command]
fn position_bottom_right(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = window.primary_monitor() {
            let workarea = monitor.work_area();
            if let Ok(win_size) = window.outer_size() {
                let margin_x = 24;
                let margin_y = 24;
                let target_x = workarea.position.x + workarea.size.width as i32 - win_size.width as i32 - margin_x;
                let target_y = workarea.position.y + workarea.size.height as i32 - win_size.height as i32 - margin_y;
                window.set_position(tauri::PhysicalPosition::new(target_x, target_y)).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    } else {
        Err("Janela principal não encontrada".into())
    }
}

#[tauri::command]
fn minimize_player(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.minimize().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Janela principal não encontrada".into())
    }
}

#[tauri::command]
fn start_window_dragging(window: tauri::WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn start_window_resize(window: tauri::WebviewWindow, direction: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        win_native::start_resize(&window, &direction)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (window, direction);
        Ok(())
    }
}

#[tauri::command]
fn set_window_position_offset(window: tauri::WebviewWindow, dx: i32, dy: i32) -> Result<(), String> {
    let current_pos = window.outer_position().map_err(|e| e.to_string())?;
    window.set_position(tauri::PhysicalPosition::new(current_pos.x + dx, current_pos.y + dy)).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_fullscreen(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        let is_fs = window.is_fullscreen().map_err(|e| e.to_string())?;
        let next = !is_fs;
        #[cfg(target_os = "windows")]
        win_native::IS_FULLSCREEN.store(next, std::sync::atomic::Ordering::Relaxed);
        window.set_fullscreen(next).map_err(|e| e.to_string())?;
        Ok(next)
    } else {
        Err("Janela principal não encontrada".into())
    }
}

#[tauri::command]
fn close_app(app: AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::Space) {
                            let _ = toggle_player_visibility(app.clone());
                        } else if shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyA) {
                            let _ = open_quick_add(app.clone());
                        } else if shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::ArrowRight) {
                            let _ = app.emit("shortcut-next", ());
                        } else if shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::ArrowLeft) {
                            let _ = app.emit("shortcut-previous", ());
                        } else if shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyT) {
                            let _ = toggle_always_on_top(app.clone());
                        }
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Posiciona a janela principal inicialmente no canto inferior direito
            let handle = app.handle().clone();
            let _ = position_bottom_right(handle.clone());

            #[cfg(target_os = "windows")]
            {
                if let Some(main_win) = app.get_webview_window("main") {
                    win_native::install_window_hooks(&main_win);
                }
                if let Some(quick_win) = app.get_webview_window("quick-add") {
                    win_native::apply_borderless_rounded(&quick_win);
                }
                if let Some(auth_win) = app.get_webview_window("auth") {
                    win_native::apply_borderless_rounded(&auth_win);
                }
            }

            // Registra atalhos globais padrão
            let global_shortcut = app.global_shortcut();
            let shortcuts = ["Ctrl+Shift+Space", "Ctrl+Shift+A", "Ctrl+Shift+Right", "Ctrl+Shift+Left", "Ctrl+Shift+T"];
            for s in shortcuts {
                if let Ok(sc) = s.parse::<Shortcut>() {
                    let _ = global_shortcut.register(sc);
                }
            }

            // Auto-importa cookies de autenticação do YouTube/Google em segundo plano
            let auto_app = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(1200));
                let _ = import_cookies_internal(&auto_app, None);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            toggle_player_visibility,
            toggle_always_on_top,
            get_always_on_top,
            open_quick_add,
            close_quick_add,
            set_window_preset,
            position_bottom_right,
            minimize_player,
            start_window_dragging,
            start_window_resize,
            set_window_position_offset,
            toggle_fullscreen,
            close_app,
            import_browser_cookies,
            open_youtube_login,
            open_auth_window,
            close_auth_window,
            fetch_youtube_playlist,
            check_youtube_auth
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

