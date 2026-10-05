// Facts shown in several places. Update when a release ships.
export const INSTALL_URL = "https://raw.githubusercontent.com/ehilzinger/kwerft-install/main/install.sh";
export const INSTALL_CMD = `curl -fsSL ${INSTALL_URL} | sudo bash -s -- --domain ops.example.com --email ops@example.com --yes`;
export const RELEASES_URL = "https://github.com/ehilzinger/kwerft-install/releases";
export const LATEST = "v0.4.0";
/** The same command, broken over two lines for display. */
export const INSTALL_DISPLAY = `curl -fsSL ${INSTALL_URL} \\\n  | sudo bash -s -- --domain ops.example.com --email ops@example.com --yes`;
