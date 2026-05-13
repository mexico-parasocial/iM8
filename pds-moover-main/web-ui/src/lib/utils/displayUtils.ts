function formatBytes(bytes: number | null) {
    if (bytes == null) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let v = Number(bytes);
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i++;
    }
    return v.toFixed(1) + ' ' + units[i];
}

function formatDate(value: string | undefined) {
    if (!value) return '—';
    try {
        const d = new Date(value);
        return d.toLocaleString();
    } catch (_) {
        return String(value);
    }
}

export {formatBytes, formatDate};