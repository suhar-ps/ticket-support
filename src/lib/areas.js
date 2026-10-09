// Daftar area operasional. Perusahaan di tiap area disimpan di database
// (kolom companies.area) — file ini hanya daftar area untuk dropdown dan
// satu fungsi bantu untuk menyaring perusahaan menurut area.
export const AREAS = ['Jakarta', 'Cikande']

// Perusahaan yang berada di area tertentu. Area kosong -> daftar kosong
// (dropdown perusahaan baru terisi setelah area dipilih).
export function companiesInArea(companies, area) {
  if (!area) return []
  return (companies || []).filter((c) => c.area === area)
}
