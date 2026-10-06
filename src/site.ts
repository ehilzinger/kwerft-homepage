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
/** The newest release candidate; features newer than LATEST carry its version as a badge. */
export const PREVIEW = "v0.6.0-rc.4";
/** The source code (AGPL-3.0-only). */
export const SOURCE_URL = "https://github.com/ehilzinger/kwerft";

/** The site's operator, for the Impressum and the privacy policy (same as hatchure.app's). */
export const OPERATOR = {
  name: "Enzo Elias Hilzinger",
  street: "Friedrich-Ebert-Str. 8/1",
  city: "69207 Sandhausen",
  email: "enzo@hatchure.app",
};
/** Date of the current Impressum and privacy policy. */
export const LEGAL_DATE = { de: "5. Oktober 2026", en: "5 October 2026" };
