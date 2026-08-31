import { supabase } from './supabaseClient'

/**
 * Perusahaan & kategori yang boleh dilihat/dipakai pengguna saat ini,
 * berdasarkan tabel penghubung user_companies/user_categories yang
 * diatur Super Admin lewat halaman Administrasi Pengguna.
 *
 * Super Admin selalu mendapat daftar LENGKAP (tidak dibatasi tabel
 * penghubung), konsisten dengan RLS di database (lihat fungsi
 * can_access_ticket_scope di schema.sql).
 */
export async function fetchVisibleCompaniesAndCategories(profile) {
  if (profile?.role === 'superadmin') {
    const [{ data: companies }, { data: categories }] = await Promise.all([
      supabase.from('companies').select('id, name').order('name'),
      supabase.from('categories').select('id, name').order('name'),
    ])
    return { companies: companies || [], categories: categories || [] }
  }

  const [{ data: companyLinks }, { data: categoryLinks }] = await Promise.all([
    supabase.from('user_companies').select('companies(id, name)').eq('user_id', profile.id),
    supabase.from('user_categories').select('categories(id, name)').eq('user_id', profile.id),
  ])

  const companies = (companyLinks || [])
    .map((l) => l.companies)
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))

  const categories = (categoryLinks || [])
    .map((l) => l.categories)
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))

  return { companies, categories }
}
