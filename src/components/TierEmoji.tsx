// SHIM — TierEmoji was renamed to AnimatedEmoji, but an accidental partial
// commit (7c1b182) landed the file rename without the corresponding import
// updates. Re-export from AnimatedEmoji until Dex's rename PR fully lands,
// at which point this file can be deleted.
export { default } from "./AnimatedEmoji";
