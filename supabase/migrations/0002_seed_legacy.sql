-- Le 20 foto già nel sito (stesse immagini di assets/img/gal-N-*): il cliente può riordinarle
-- ed eliminarle insieme alle nuove. Eseguire dopo 0001_gallery.sql.
insert into public.gallery_photos (position, legacy_key, width, height, caption, category) values
  (1, 'gal-10', 1200, 1600, 'Prato a strisce davanti alla villa', 'prati'),
  (2, 'gal-22', 1200, 1600, 'Prato e vialetto in pietra in montagna', 'montagna'),
  (3, 'gal-19', 1200, 1600, 'Olivo a nuvole e ghiaia decorativa', 'corten'),
  (4, 'gal-15', 1200, 1600, 'Recinzione in pali di castagno', 'recinzioni'),
  (5, 'gal-16', 1200, 1600, 'Terreno pronto per la semina', 'preparazione'),
  (6, 'gal-20', 1200, 1600, 'Prato tagliato a strisce', 'prati'),
  (7, 'gal-23', 1200, 1600, 'Scalini, vialetto e prato', 'montagna'),
  (8, 'gal-13', 1200, 1600, 'Giardino in ghiaia e corten', 'corten'),
  (9, 'gal-17', 1200, 1600, 'Semina autunnale rullata', 'preparazione'),
  (10, 'gal-11', 1200, 1600, 'Prato all''inglese e ghiaia rossa', 'prati'),
  (11, 'gal-21', 1200, 1600, 'Siepi rifilate', 'prati'),
  (12, 'gal-18', 1200, 1600, 'Terreno lavorato per il nuovo prato', 'preparazione'),
  (13, 'gal-12', 1200, 1600, 'Vasche in corten e ghiaia', 'corten'),
  (14, 'gal-4', 1200, 1600, 'Bordura con peonia', 'prati'),
  (15, 'gal-1', 1200, 1600, 'Prato e bordura con rose', 'prati'),
  (16, 'gal-14', 1200, 1600, 'Rosmarino nella vasca in corten', 'corten'),
  (17, 'gal-2', 1200, 1600, 'Prato lungo il muretto in pietra', 'prati'),
  (18, 'gal-3', 1200, 1600, 'Angolo barbecue', 'prati'),
  (19, 'gal-7', 1200, 1600, 'Aiuole davanti a un negozio', 'commerciale'),
  (20, 'gal-8', 1200, 1600, 'Cippato, corteccia e graminacee', 'commerciale')
on conflict (legacy_key) do nothing;
