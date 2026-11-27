// Optional parts of the site. Each folder here may export `routes` ({ path, element }[])
// from routes.jsx; the site loads whichever add-ons are present and builds without any.
const modules = import.meta.glob('./*/routes.jsx', { eager: true })

export const addonRoutes = Object.values(modules).flatMap((m) => m.routes ?? [])
