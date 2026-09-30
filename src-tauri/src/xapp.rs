//! Cinnamon and MATE tray (Linux Mint): their panels show a text label next to a tray icon only for XApp status
//! icons (libxapp) — the AppIndicator/StatusNotifierItem label that GNOME shows is ignored there, so the prayer
//! timer would be missing. On those desktops the tray is an XAppStatusIcon: icon, timer label, tooltip, left click
//! opens the prayer panel, right click the menu.
//!
//! libxapp is loaded at run time, so the binary still runs where it is not installed. GTK objects live on the main
//! thread only; other threads send updates with `run_on_main_thread`.

use gtk::glib::{self, gobject_ffi::GObject, translate::ToGlibPtr};
use gtk::prelude::*;
use libloading::Library;
use std::cell::{Cell, RefCell};
use std::ffi::{c_char, c_int, CString};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tauri::{AppHandle, Manager, Wry};

type NewWithName = unsafe extern "C" fn(*const c_char) -> *mut GObject;
type SetStr = unsafe extern "C" fn(*mut GObject, *const c_char);
type SetBool = unsafe extern "C" fn(*mut GObject, c_int);
type SetMenu = unsafe extern "C" fn(*mut GObject, *mut gtk::ffi::GtkMenu);
type AnyMonitors = unsafe extern "C" fn() -> c_int;

struct Api {
    _lib: Library,
    new_with_name: NewWithName,
    set_icon_name: SetStr,
    set_label: SetStr,
    set_tooltip_text: SetStr,
    set_visible: SetBool,
    set_secondary_menu: SetMenu,
    any_monitors: AnyMonitors,
}

fn api() -> Option<&'static Api> {
    static API: OnceLock<Option<Api>> = OnceLock::new();
    API.get_or_init(|| {
        // SAFETY: libxapp is a plain C library; the symbols are resolved once and the library is kept loaded for
        // the life of the process (it is owned by the static).
        unsafe {
            let lib = Library::new("libxapp.so.1").ok()?;
            Some(Api {
                new_with_name: *lib.get::<NewWithName>(b"xapp_status_icon_new_with_name\0").ok()?,
                set_icon_name: *lib.get::<SetStr>(b"xapp_status_icon_set_icon_name\0").ok()?,
                set_label: *lib.get::<SetStr>(b"xapp_status_icon_set_label\0").ok()?,
                set_tooltip_text: *lib.get::<SetStr>(b"xapp_status_icon_set_tooltip_text\0").ok()?,
                set_visible: *lib.get::<SetBool>(b"xapp_status_icon_set_visible\0").ok()?,
                set_secondary_menu: *lib.get::<SetMenu>(b"xapp_status_icon_set_secondary_menu\0").ok()?,
                any_monitors: *lib.get::<AnyMonitors>(b"xapp_status_icon_any_monitors\0").ok()?,
                _lib: lib,
            })
        }
    })
    .as_ref()
}

/// Use the XApp tray on Cinnamon/MATE (or wherever an XApp status applet is running) when libxapp is present.
/// `AHD_TRAY=sni` forces the AppIndicator tray, `AHD_TRAY=xapp` forces this one.
pub fn wanted() -> bool {
    match std::env::var("AHD_TRAY").as_deref() {
        Ok("sni") => return false,
        Ok("xapp") => return api().is_some(),
        _ => {}
    }
    let Some(api) = api() else { return false };
    let desktop = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default().to_ascii_lowercase();
    // SAFETY: plain query function without arguments.
    desktop.contains("cinnamon") || desktop.contains("mate") || unsafe { (api.any_monitors)() } != 0
}

fn cstr(s: &str) -> CString {
    CString::new(s.replace('\0', "")).unwrap_or_default()
}

/// Menu entries, in order. Ids match `tray::on_menu`.
const INFO_ROWS: usize = 9; // weekday + hijri, gregorian, place, 6 prayer rows

struct Tray {
    icon: glib::Object,
    _menu: gtk::Menu,
    info: Vec<gtk::MenuItem>,
    panel: gtk::MenuItem,
    stop: gtk::MenuItem,
    widget: gtk::CheckMenuItem,
    mini: gtk::CheckMenuItem,
    settings: gtk::MenuItem,
    open: gtk::MenuItem,
    quit: gtk::MenuItem,
}

thread_local! {
    static TRAY: RefCell<Option<Tray>> = const { RefCell::new(None) };
    /// set while the app changes check items itself, so their handlers do not act on it
    static UPDATING: Cell<bool> = const { Cell::new(false) };
}

fn raw(o: &glib::Object) -> *mut GObject {
    o.to_glib_none().0
}

/// Create the status icon. Must run on the main (GTK) thread, e.g. in `setup`.
pub fn create(app: &AppHandle<Wry>, icon_path: &Path) -> bool {
    let Some(api) = api() else { return false };
    let name = cstr("ahd");
    // SAFETY: returns a new reference owned by the Object below.
    let ptr = unsafe { (api.new_with_name)(name.as_ptr()) };
    if ptr.is_null() {
        return false;
    }
    // SAFETY: ptr is a valid, fully owned GObject (XAppStatusIcon).
    let icon: glib::Object = unsafe { glib::translate::from_glib_full(ptr) };

    let menu = gtk::Menu::new();
    let info: Vec<gtk::MenuItem> = (0..INFO_ROWS)
        .map(|_| {
            let it = gtk::MenuItem::with_label(" ");
            it.set_sensitive(false);
            it
        })
        .collect();
    for (i, it) in info.iter().enumerate() {
        menu.append(it);
        if i == 2 || i == INFO_ROWS - 1 {
            menu.append(&gtk::SeparatorMenuItem::new());
        }
    }
    let item = |id: &'static str| {
        let it = gtk::MenuItem::with_label(" ");
        let app = app.clone();
        it.connect_activate(move |_| crate::tray::on_menu(&app, id));
        it
    };
    let check = |id: &'static str| {
        let it = gtk::CheckMenuItem::with_label(" ");
        let app = app.clone();
        it.connect_activate(move |_| {
            if !UPDATING.with(Cell::get) {
                crate::tray::on_menu(&app, id);
            }
        });
        it
    };
    let panel = item("panel");
    let stop = item("stop");
    let widget = check("toggle-widget");
    let mini = check("toggle-mini");
    let settings = item("settings");
    let open = item("open");
    let quit = item("quit");
    menu.append(&panel);
    menu.append(&stop);
    menu.append(&gtk::SeparatorMenuItem::new());
    menu.append(&widget);
    menu.append(&mini);
    menu.append(&settings);
    menu.append(&gtk::SeparatorMenuItem::new());
    menu.append(&open);
    menu.append(&quit);
    menu.show_all();

    let icon_c = cstr(&icon_path.to_string_lossy());
    let tip = cstr("3ahd");
    // SAFETY: icon is alive; strings are valid NUL-terminated C strings copied by libxapp; the menu pointer stays
    // valid because the menu is kept in `Tray` for the life of the icon.
    unsafe {
        (api.set_icon_name)(raw(&icon), icon_c.as_ptr());
        (api.set_tooltip_text)(raw(&icon), tip.as_ptr());
        (api.set_secondary_menu)(raw(&icon), menu.to_glib_none().0);
        (api.set_visible)(raw(&icon), 1);
    }
    // left click (no primary menu): the prayer panel, as on Windows
    let app2 = app.clone();
    icon.connect_local("activate", false, move |_| {
        crate::tray::on_menu(&app2, "panel");
        None
    });

    TRAY.with(|t| {
        *t.borrow_mut() = Some(Tray { icon, _menu: menu, info, panel, stop, widget, mini, settings, open, quit });
    });
    true
}

/// What changed since the last update (None = unchanged).
#[derive(Default, Clone)]
pub struct Update {
    pub label: Option<String>,
    pub tooltip: Option<String>,
    pub icon: Option<PathBuf>,
    /// panel, stop, widget, mini, settings, open, quit
    pub texts: Option<[String; 7]>,
    pub info: Option<Vec<String>>,
    pub checked: Option<(bool, bool)>,
    pub stop_enabled: Option<bool>,
    pub visible: Option<bool>,
}

pub fn apply(app: &AppHandle<Wry>, u: Update) {
    let _ = app.run_on_main_thread(move || {
        let Some(api) = api() else { return };
        TRAY.with(|t| {
            let t = t.borrow();
            let Some(t) = t.as_ref() else { return };
            // SAFETY: called on the main thread with a live icon and valid C strings.
            unsafe {
                if let Some(l) = &u.label {
                    let c = cstr(l);
                    (api.set_label)(raw(&t.icon), c.as_ptr());
                }
                if let Some(tip) = &u.tooltip {
                    let c = cstr(tip);
                    (api.set_tooltip_text)(raw(&t.icon), c.as_ptr());
                }
                if let Some(p) = &u.icon {
                    let c = cstr(&p.to_string_lossy());
                    (api.set_icon_name)(raw(&t.icon), c.as_ptr());
                }
                if let Some(v) = u.visible {
                    (api.set_visible)(raw(&t.icon), c_int::from(v));
                }
            }
            if let Some([panel, stop, widget, mini, settings, open, quit]) = &u.texts {
                t.panel.set_label(panel);
                t.stop.set_label(stop);
                t.widget.set_label(widget);
                t.mini.set_label(mini);
                t.settings.set_label(settings);
                t.open.set_label(open);
                t.quit.set_label(quit);
            }
            if let Some(rows) = &u.info {
                for (item, text) in t.info.iter().zip(rows) {
                    item.set_label(text);
                    item.set_visible(!text.is_empty());
                }
            }
            if let Some((w, m)) = u.checked {
                UPDATING.with(|f| f.set(true));
                t.widget.set_active(w);
                t.mini.set_active(m);
                UPDATING.with(|f| f.set(false));
            }
            if let Some(e) = u.stop_enabled {
                t.stop.set_sensitive(e);
            }
        });
    });
}

/// The tray icon as a file the panel (another process, outside a Flatpak sandbox) can read.
pub fn icon_file(app: &AppHandle<Wry>, name: &str, png: &[u8]) -> Option<PathBuf> {
    let dir = app.path().app_cache_dir().ok()?;
    std::fs::create_dir_all(&dir).ok()?;
    let path = dir.join(name);
    if std::fs::read(&path).ok().as_deref() != Some(png) {
        std::fs::write(&path, png).ok()?;
    }
    Some(path)
}
