export const getFullPageUrl = (currentUrl: string): string => {
    const url = new URL(currentUrl);
    if (url.pathname.endsWith("/popup.html")) {
        url.pathname = `${url.pathname.slice(0, -"/popup.html".length)}/tool.html`;
    }
    return url.toString();
};
