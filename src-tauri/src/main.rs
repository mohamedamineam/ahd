// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ahd_lib::migrate_app_id();
    ahd_lib::apply_x11_compat();
    ahd_lib::run()
}
