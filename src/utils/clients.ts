export const mapClient = (c: any) => ({
  ...c,
  id: c.client_id || c.id,
  nombre: c.nombre || c.first_name || '',
  apellido: c.apellido || c.last_name || '',
  documento: c.documento || c.document_number || '',
  direccion: c.direccion || c.address || '',
  telefono: c.telefono || c.phone || '',
  email: c.email || '',
});
