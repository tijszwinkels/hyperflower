# Install Hyperflower in Omarchy

These instructions start from **Omarchy without Hyprsaver**. They are intended for a user or a coding agent working with that user's approval. Installing the shader, adding a launcher, and replacing the automatic screensaver are separate steps.

**Keep the existing lock command, lock deadline, suspend handling, and idle-inhibitor behavior.** Hyperflower and Hyprsaver are visuals, not authentication or a screen lock. Never copy this project's author's personal idle timings.

## Integration notes

- **Omarchy versions use different idle systems.** Identify whether the machine uses Quickshell, hypridle, or a custom integration; there is no universal setup command.
- **Hyprsaver is not a terminal window.** Its Wayland layer-shell surfaces need process-lifetime tracking instead of the stock terminal screensaver's window-open/close tracking.
- **Timeout changes may need an idle-monitor reset.** A hot-reloaded setting can appear correctly in status while the existing monitor fails to trigger. See [the verified workaround](#timeout-changed-but-the-screensaver-does-not-start).

## 1. Identify the installed version and idle backend

Read any machine-local Omarchy instructions first. Record:

```bash
omarchy version
hyprctl version
command -v hyprsaver || test -x "$HOME/.local/bin/hyprsaver"
pgrep -a -x hypridle
omarchy commands
```

A missing executable/process is useful discovery, not permission to start another idle daemon. Inspect the active configuration and autostart entries:

| Installed architecture | Configuration to inspect | Integration below |
| --- | --- | --- |
| Quickshell service with `omarchy.idle` or a user clone | `~/.config/omarchy/shell.json`, active plugin manifest and `Service.qml` | [Quickshell](#4a-quickshell-idle-plugin) |
| Running `hypridle` | Its actual config path (often `~/.config/hypr/hypridle.conf`) and process/service launch arguments | [hypridle](#4b-hypridle-based-omarchy) |
| Already runs Hyprsaver | Existing command, config path, and lifecycle handling | Install/select the shader; preserve the working integration |
| Unknown, mixed, or substantially different | Inspect current version's documentation/source | Do not guess; leave auto-start unchanged and offer the manual launcher |

Do not choose a branch solely from an Omarchy version number. The Quickshell source inspected for this guide was **Omarchy 4.0.3-mac.1**, a platform-specific build, not proof of all upstream releases' behavior. The native shader was tested with **Hyprsaver 0.4.7**. Later releases may have a supported screensaver-command setting; prefer that over code changes, but still verify lifecycle and locking.

Record existing screensaver/lock/display-off deadlines, lock and wake commands, and whether automatic idle behavior is enabled. Back up the files you will edit; record plugin selections and any pre-existing customizations. Never edit packaged files under `/usr/share/omarchy/`, reset the user's whole config, or globally shadow `omarchy-launch-screensaver`.

## 2. Install Hyprsaver if missing

Check [upstream](https://github.com/maravexa/hyprsaver#readme) and the selected release's requirements before installing. Do not pipe an online installer into a shell. If Hyprsaver is already present, verify `--version` and `--help`; do not replace it unnecessarily.

### Arch/Omarchy prerequisites

Hyprsaver 0.4.7 declares **Rust 1.88 or newer**. It needs a native compiler/build tools, `pkg-config`, Wayland, xkbcommon, and EGL/OpenGL ES development/runtime libraries. Its browser-like visuals do **not** require Chromium.

Inspect before installing:

```bash
rustc --version
cargo --version
pkg-config --modversion wayland-client xkbcommon egl
pacman -Q base-devel pkgconf wayland libxkbcommon mesa libglvnd
```

With approval, install only missing prerequisites using the installed Omarchy package command (verify `omarchy pkg add --help` first). Typical Arch package names:

```bash
omarchy pkg add base-devel pkgconf wayland libxkbcommon mesa libglvnd
```

GPU drivers are machine-specific; preserve the functioning driver stack, especially on NVIDIA or platform-specific builds. Do not replace drivers just to satisfy this example. If Rust is absent, an Arch-managed option is `omarchy pkg add rust`. If Rust is managed by rustup or mise already, use that existing toolchain instead—do not install a conflicting second manager or change the user's global default without approval.

### Reproducible user-local installation

After dependencies are ready, install the known shader-compatible release from crates.io:

```bash
cargo install hyprsaver --version '=0.4.7' --locked --root "$HOME/.local"
"$HOME/.local/bin/hyprsaver" --version
"$HOME/.local/bin/hyprsaver" --help
```

Run as the intended user, **not root**. This builds downloaded application/dependency code; obtain approval for that installation. Do not use `--force` to overwrite an existing binary. If this older version no longer builds on a newer toolchain/system, inspect the error and upstream releases rather than removing `--locked` blindly. Record the version actually used.

This guide's examples assume the resulting executable is `~/.local/bin/hyprsaver`. If your installation is elsewhere, substitute its verified absolute path in every launch, quit, and desktop-entry command. Desktop services may not share an interactive shell's PATH.

## 3. Install and test the shader first

Follow [the Hyprsaver guide](hyprsaver.md#2-copy-the-shader-preserving-existing-files) to copy `hyperflower.frag`, validate it headlessly, and select `general.shader = "hyperflower"` in the existing TOML configuration. Use the executable discovered above if `hyprsaver` is not on PATH.

Do not overwrite the entire TOML file. Preserve frame rate, dismissal settings, palettes, monitor overrides, and unrelated options. Check explicit `--shader`/`--config` launch arguments that could override the default.

With the user's approval, test a windowed preview:

```bash
"$HOME/.local/bin/hyprsaver" --preview --shader hyperflower
```

Do not enable automatic launch until rendering and input dismissal work. A manual launcher alone is a useful installation outcome when automatic integration cannot be safely verified.

## 4A. Quickshell idle plugin

### Scope and preparation

This is a **source-matched integration recipe**, not a universal patch. The inspected stock service uses these functions/objects:

- `launchScreensaver`, `lockSystem`, `cancelIdleCycle`, `handleActiveSignal`;
- `screensaverProcess`, `screensaverLaunchGraceTimer`, `lockTimer`, `idleMonitor`;
- terminal tracking through `screensaverWindowCount` and `org.omarchy.screensaver` window events.

Read the installed service and its helpers in full. If these contracts differ, adapt to the installed source and review/test the result; do not apply textual replacements blindly. Do not copy this machine's private `tijs.idle` plugin into another user's setup.

**Why changing only the command is insufficient:** Hyprsaver uses Wayland layer-shell surfaces, not normal Hyprland windows. Stock window-open/close tracking will not see them. The service must track the foreground process instead, without letting launch/focus events cancel the lock deadline.

Discover supported commands:

```bash
omarchy plugin clone --help
omarchy plugin list --help
omarchy plugin enable --help
omarchy plugin disable --help
```

If the built-in `omarchy.idle` is active, back up `shell.json`, then—with approval—clone it:

```bash
omarchy plugin clone omarchy.idle
```

On the inspected version this **immediately activates** a user-owned clone and disables the original. Read the returned ID/path; do not assume a username or clone name. If a customized idle clone is already active, back it up and adapt that clone instead. Never run two idle services simultaneously. Plugin edits hot-reload; prepare and check the complete edit before saving, while the user is present and no idle cycle is underway.

### Required adaptations in the user-owned clone

Keep the original timeout calculations and lock/wake implementations. Make the following changes together:

1. **Foreground process launch.** Retain the locked-state and screensaver-disabled checks. Launch Hyprsaver using `exec`, without `&`, a detached service, or a launcher that exits early. The tracked `Process.running` must cover the saver lifetime. Treat a failed locked-state query conservatively: skip the visual, but retain the independent lock deadline.

   For the inspected shell API, the *shell command* inside `runProcess` can be structured as follows (encode/escape it correctly if placed in a QML string):

   ```bash
   state=$(omarchy-shell lock isLocked 2>/dev/null) || exit 75
   [ "$state" = false ] || exit 75
   omarchy-toggle-enabled screensaver-off && exit 75
   exec "$HOME/.local/bin/hyprsaver"
   ```

   Exit 75 distinguishes skipped launches from a normal saver dismissal. Verify both command APIs and the `true`/`false` response on the target release. Do not install this command on a version lacking those APIs.

2. **Track process lifetime, not terminal windows.** In `handleActiveSignal`, preserve the existing lock timer while `screensaverProcess.running` or the short launch-grace timer is true. Do not wait for a layer-shell overlay to produce an `openwindow` event. Retire the old screensaver window-close cancellation path for this route so an unrelated terminal saver cannot cancel its lock cycle.

3. **Handle dismissal and failures distinctly.** In `screensaverProcess.onExited`, log the exit status. A successful normal exit accompanied by actual active input may cancel the current idle cycle, just as the stock saver dismissal did. A failed/crashed/skipped launch must **not** cancel or restart the original lock deadline. Keep the timer armed; if the state is ambiguous after an active notification, lock conservatively instead of interpreting it as user activity. Check Quickshell's `exitStatus` enum for this version rather than assuming all exits are normal. Do not equate every process exit with a mouse/key dismissal.

4. **Update launch-grace handling too.** Replace the terminal-window test with process state. If no process exists when grace expires, do not run the stock unconditional `cancelIdleCycle("screensaver-not-running")` path after a launch-induced active notification: that can silently remove the lock timer. Leave the original deadline armed (or lock early on ambiguity). Ensure subsequent active notifications cannot turn a known launch failure into a successful-dismissal event; keep an explicit launch-failure/skipped flag until the cycle resets if needed.

5. **Keep locking independent.** At the original lock deadline, always invoke the existing lock command regardless of whether Hyprsaver launched, crashed, or is still alive. Never gate locking on shader/process success. Arrange for `hyprsaver --quit` when transitioning to the lock screen without delaying or replacing the lock request; prefer observing confirmed locked state before removing the visual. Inspect whether the installed lock command returns before or after lock activation. Never assume a shell command's exit alone proves authentication is active.

6. **Cleanup on genuine resume.** On normal cancellation/user wake, quit Hyprsaver and retain the original wake/brightness restoration. Ensure cleanup doesn't fire an exit callback that cancels a newly created cycle. Reset lifecycle flags in the same places as the original cycle flags. Cover manual lock and suspend/resume as well as timed lock; the stock terminal-cleanup command may not know about Hyprsaver.

These are lifecycle requirements, not a claim that arbitrary existing Omarchy clones satisfy them. Implement and inspect the actual diff, then run the acceptance checks below. If the version has no safe supported integration point or you cannot validate lock behavior, restore the stock plugin and leave only the manual launcher.

### Apply and inspect

Use the target version's documented hot reload or plugin rescan; do not restart the whole desktop as an incidental step. On the inspected version, `omarchy-shell idle status` reports current deadlines, timer/process state, and the last event. Verify exactly one idle provider is active and that the recorded deadlines/inhibitor behavior are unchanged. Shell logs must show no QML load errors.

### Timeout changed but the screensaver does not start

Observed locally on the Quickshell-based setup: status showed the new timeout, but the existing monitor stayed active even though fresh monitors detected idle correctly. Resetting just the idle monitor restored automatic launch; the user confirmed the flower appeared. A whole-desktop restart was unnecessary. The underlying cause has not been established.

First inspect `omarchy-shell idle status`. If automatic idle is intentionally disabled, preserve that state—do not enable it without permission. If it is enabled and this symptom occurs, with the user present and approving the brief reset:

```bash
# Only when idle was enabled before this reset.
# A subshell keeps the recovery trap local to this operation.
(
  trap 'omarchy-shell idle enable >/dev/null' EXIT
  omarchy-shell idle disable || exit 1
  sleep 1
  omarchy-shell idle enable || exit 1
)
omarchy-shell idle status
```

Confirm `enabled: true` and the intended screensaver/lock deadlines afterward. The reset cancels the current idle cycle and briefly pauses automatic idle handling; do not perform it unattended or while relying on a pending lock. If re-enabling fails, restore the idle service immediately or manually lock the machine. Leave input untouched for the configured delay to test activation.

Do not disable inhibitor handling to work around this symptom. On setups with separate controls, a coffee-cup sleep inhibitor is not the same as the automatic-screensaver/lock toggle. This workaround verified automatic launch, not authentication locking.

## 4B. hypridle-based Omarchy

Use this branch **only if hypridle actually owns idle behavior**. Do not install/start it alongside Quickshell's idle service. Read the active config, its `general` block, all listeners, and current installed hypridle documentation first.

1. Back up the active config.
2. Locate the existing screensaver listener. Keep its numeric timeout unchanged and replace its launch command with the verified Hyprsaver executable. Preserve equivalent screensaver-disabled/already-locked guards using the APIs present on that release; do not paste Quickshell-only commands into an older installation.
3. Add Hyprsaver cleanup to that listener's existing `on-resume`, preserving any existing wake/brightness actions. Do not create duplicate listeners or replace the whole file with an upstream example.
4. Leave the independent lock listener's timeout and lock command untouched. Keep `lock_cmd`, `before_sleep_cmd`, `after_sleep_cmd`, DPMS listeners, and inhibitor settings intact. If cleanup on lock is needed, compose it with the actual lock flow without making locking conditional on Hyprsaver success or on its `--quit` command.

The relevant pieces have this shape; **`EXISTING_*` placeholders are not runnable values**:

```ini
listener {
    timeout = EXISTING_SCREENSAVER_TIMEOUT
    on-timeout = /ABSOLUTE/PATH/TO/guarded-hyprsaver-launcher
    on-resume = /ABSOLUTE/PATH/TO/hyprsaver --quit; EXISTING_RESUME_ACTIONS
}
# Preserve the separate lock listener and general/sleep settings.
```

If the existing launch command already has the correct guards, keep them and replace only its final saver executable; a separate wrapper is optional. With no pre-existing screensaver listener, ask for a desired delay earlier than the lock deadline rather than inventing a new one. If the lock deadline is already earlier, explain that an unlocked animation may never appear; do not extend it automatically.

Inspect how the actual hypridle version reloads. If a service restart is needed, coordinate it with the user, verify it resumes successfully, and do not leave locking disabled. Confirm whether Hyprsaver's focus/input-grab events cause `on-resume` to fire immediately or reset the lock listener. If they do, this simple listener recipe is not sufficient: roll back rather than disabling inhibitors or removing the lock listener to make the animation work.

## 5. Optional Super+Space launcher

With approval, back up any existing entry and create `~/.local/share/applications/hyperflower.desktop`:

```ini
[Desktop Entry]
Version=1.0
Type=Application
Name=Hyperflower
Comment=Start the psychedelic flower screensaver
Exec=/ABSOLUTE/PATH/TO/hyprsaver --shader hyperflower
TryExec=/ABSOLUTE/PATH/TO/hyprsaver
Icon=preferences-desktop-screensaver
Terminal=false
Categories=Utility;
Keywords=flower;screensaver;hyprsaver;psychedelic;
StartupNotify=false
```

Replace both executable paths with the verified local path. Desktop entries do not expand `~` or shell variables; quote paths according to desktop-entry syntax if necessary. Validate and refresh with these tools, if installed:

```bash
desktop-file-validate ~/.local/share/applications/hyperflower.desktop
update-desktop-database ~/.local/share/applications
```

Search “Hyperflower” in Super+Space. This explicitly runs Hyprsaver; Omarchy's stock manual screensaver command remains untouched. Manual launch is not locking.

## 6. Acceptance checks: do not skip locking

Perform desktop tests with the user present. Keep a terminal/recovery route available. Do not disable authentication. Prefer existing deadlines; temporarily shortening them is a separate, explicitly approved test change that must be restored afterward.

| Test | Required result |
| --- | --- |
| Normal idle, no input | Hyperflower starts at the original saver deadline; real lock activates at the original lock deadline measured from idle start, not saver start |
| Mouse/key dismissal | Saver exits, ordinary activity resets the idle cycle, future idle still locks |
| Missing binary or shader failure in a controlled test | No stale overlay and no cancellation of the independent lock deadline |
| Saver crash/abnormal exit | Lock deadline stays armed or system locks early; never silently disables locking |
| Saver disabled but locking enabled | Original automatic lock still works |
| Manual lock while saver is visible | Actual authentication lock appears; saver cleanup cannot unlock or delay it |
| Suspend/resume | Existing before-sleep lock and wake behavior remain intact |
| Idle inhibitor / pause-idle control | Same behavior as before integration; no new global inhibitor is added |
| Multiple monitors | Expected coverage and dismissal; no leftover layers after locking/wake |
| Next login | Exactly one idle manager/provider, no duplicate launches, persisted deadlines unchanged |

Record versions, file diffs, tests actually performed, and any untested cases. Shader benchmarks and valid JSON/TOML do not prove secure locking. **This repository's initial validation covered shader rendering and browser behavior, not a clean-install end-to-end Omarchy lock test.** These instructions must be validated on the target machine before declaring its automatic integration complete.

## Rollback

- Restore the previous shader selection, preserving subsequent unrelated TOML edits.
- For a new Quickshell clone, use the installed plugin commands to restore the original active provider and disable the new clone; verify only one provider remains. If editing an existing clone, restore only the integration changes from its backup.
- For hypridle, restore the changed listener/cleanup settings and apply using that version's supported procedure. Verify the daemon and original locking behavior afterward.
- Remove the optional launcher and refresh the desktop database.
- Remove `hyperflower.frag` only after removing its references. If Hyprsaver was newly installed via the Cargo command above and is no longer wanted/used, `cargo uninstall hyprsaver --root "$HOME/.local"` reverses that installation. Do not remove a pre-existing installation or shared build/driver packages.
- Retain backups until the original behavior is confirmed. Do not use a full Omarchy config reset as rollback.
