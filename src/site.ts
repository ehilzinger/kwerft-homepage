// Facts shown in several places. Update when a release ships.
/** The advertised installer URL; netlify.toml forwards it to the kwerft-install repo. */
export const INSTALL_URL = "https://kwerft.dev/install.sh";
/** Where the script actually lives (what /install.sh redirects to). */
export const SCRIPT_SOURCE = "https://github.com/ehilzinger/kwerft-install";
export const INSTALL_CMD = `curl -fsSL ${INSTALL_URL} | sudo bash -s -- --domain ops.example.com --email ops@example.com --yes`;
/** The same command, broken over two lines for display. */
export const INSTALL_DISPLAY = `curl -fsSL ${INSTALL_URL} | sudo bash -s -- \\\n  --domain ops.example.com --email ops@example.com --yes`;
export const RELEASES_URL = "https://github.com/ehilzinger/kwerft-install/releases";
export const LATEST = "v0.4.0";
