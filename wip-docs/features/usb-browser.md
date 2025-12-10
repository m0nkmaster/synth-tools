# USB Browser

Browser-based interface for managing OP-Z sample packs when device is connected via USB-C.

## Features

- **Auto-detect**: Scans `/Volumes/OP-Z/sample packs` structure
- **Visual layout**: Shows all 4 tracks × 10 slots
- **Upload**: Add `.aif` files to empty slots
- **Delete**: Remove existing sample packs
- **Duplicate detection**: Shows `~` prefixed files (0 bytes)

## Structure

```
/Volumes/OP-Z/sample packs/
  1-kick/01..10/
  2-snare/01..10/
  3-perc/01..10/
  4-sample/01..10/
```

## Implementation

- Uses File System Access API (`showDirectoryPicker`)
- Read/write operations on mounted OP-Z volume
- Minimal UI: folder tree + upload/delete buttons
- Real-time refresh after operations

## Limitations

- Requires Chromium-based browser (Chrome, Edge)
- User must grant filesystem permissions
- No validation of AIFF format (assumes valid files)
