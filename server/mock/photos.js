export const MOCK_ALBUM_ID = 'demo-album';

export const PHOTOS = [
  {
    id: 'photo-1',
    albumId: MOCK_ALBUM_ID,
    url: 'https://images.pexels.com/photos/1587009/pexels-photo-1587009.jpeg?auto=compress&cs=tinysrgb&w=1200&q=80',
    thumbnailUrl:
      'https://images.pexels.com/photos/1587009/pexels-photo-1587009.jpeg?auto=compress&cs=tinysrgb&w=300&q=80',
    title: 'Family memory #1',
    index: 0,
  },
  {
    id: 'photo-2',
    albumId: MOCK_ALBUM_ID,
    url: 'https://images.pexels.com/photos/755028/pexels-photo-755028.jpeg?auto=compress&cs=tinysrgb&w=1200&q=80',
    thumbnailUrl:
      'https://images.pexels.com/photos/755028/pexels-photo-755028.jpeg?auto=compress&cs=tinysrgb&w=300&q=80',
    title: 'Family memory #2',
    index: 1,
  },
  {
    id: 'photo-3',
    albumId: MOCK_ALBUM_ID,
    url: 'https://images.pexels.com/photos/1133957/pexels-photo-1133957.jpeg?auto=compress&cs=tinysrgb&w=1200&q=80',
    thumbnailUrl:
      'https://images.pexels.com/photos/1133957/pexels-photo-1133957.jpeg?auto=compress&cs=tinysrgb&w=300&q=80',
    title: 'Family memory #3',
    index: 2,
  },
  {
    id: 'photo-4',
    albumId: MOCK_ALBUM_ID,
    url: 'https://images.pexels.com/photos/708440/pexels-photo-708440.jpeg?auto=compress&cs=tinysrgb&w=1200&q=80',
    thumbnailUrl:
      'https://images.pexels.com/photos/708440/pexels-photo-708440.jpeg?auto=compress&cs=tinysrgb&w=300&q=80',
    title: 'Family memory #4',
    index: 3,
  },
  {
    id: 'photo-5',
    albumId: MOCK_ALBUM_ID,
    url: 'https://images.pexels.com/photos/572897/pexels-photo-572897.jpeg?auto=compress&cs=tinysrgb&w=1200&q=80',
    thumbnailUrl:
      'https://images.pexels.com/photos/572897/pexels-photo-572897.jpeg?auto=compress&cs=tinysrgb&w=300&q=80',
    title: 'Family memory #5',
    index: 4,
  },
  {
    id: 'photo-6',
    albumId: MOCK_ALBUM_ID,
    url: 'https://images.pexels.com/photos/210205/pexels-photo-210205.jpeg?auto=compress&cs=tinysrgb&w=1200&q=80',
    thumbnailUrl:
      'https://images.pexels.com/photos/210205/pexels-photo-210205.jpeg?auto=compress&cs=tinysrgb&w=300&q=80',
    title: 'Family memory #6',
    index: 5,
  },
  {
    id: 'photo-7',
    albumId: MOCK_ALBUM_ID,
    url: 'https://images.pexels.com/photos/262458/pexels-photo-262458.jpeg?auto=compress&cs=tinysrgb&w=1200&q=80',
    thumbnailUrl:
      'https://images.pexels.com/photos/262458/pexels-photo-262458.jpeg?auto=compress&cs=tinysrgb&w=300&q=80',
    title: 'Family memory #7',
    index: 6,
  },
  {
    id: 'photo-8',
    albumId: MOCK_ALBUM_ID,
    url: 'https://images.pexels.com/photos/2253879/pexels-photo-2253879.jpeg?auto=compress&cs=tinysrgb&w=1200&q=80',
    thumbnailUrl:
      'https://images.pexels.com/photos/2253879/pexels-photo-2253879.jpeg?auto=compress&cs=tinysrgb&w=300&q=80',
    title: 'Family memory #8',
    index: 7,
  },
  {
    id: 'photo-9',
    albumId: MOCK_ALBUM_ID,
    url: 'https://images.pexels.com/photos/775358/pexels-photo-775358.jpeg?auto=compress&cs=tinysrgb&w=1200&q=80',
    thumbnailUrl:
      'https://images.pexels.com/photos/775358/pexels-photo-775358.jpeg?auto=compress&cs=tinysrgb&w=300&q=80',
    title: 'Family memory #9',
    index: 8,
  },
  {
    id: 'photo-10',
    albumId: MOCK_ALBUM_ID,
    url: 'https://images.pexels.com/photos/1005766/pexels-photo-1005766.jpeg?auto=compress&cs=tinysrgb&w=1200&q=80',
    thumbnailUrl:
      'https://images.pexels.com/photos/1005766/pexels-photo-1005766.jpeg?auto=compress&cs=tinysrgb&w=300&q=80',
    title: 'Family memory #10',
    index: 9,
  },
  {
    id: 'photo-11',
    albumId: MOCK_ALBUM_ID,
    url: 'https://images.pexels.com/photos/935743/pexels-photo-935743.jpeg?auto=compress&cs=tinysrgb&w=1200&q=80',
    thumbnailUrl:
      'https://images.pexels.com/photos/935743/pexels-photo-935743.jpeg?auto=compress&cs=tinysrgb&w=300&q=80',
    title: 'Family memory #11',
    index: 10,
  },
  {
    id: 'photo-12',
    albumId: MOCK_ALBUM_ID,
    url: 'https://images.pexels.com/photos/2220327/pexels-photo-2220327.jpeg?auto=compress&cs=tinysrgb&w=1200&q=80',
    thumbnailUrl:
      'https://images.pexels.com/photos/2220327/pexels-photo-2220327.jpeg?auto=compress&cs=tinysrgb&w=300&q=80',
    title: 'Family memory #12',
    index: 11,
  },
];

export function getPhotosForAlbum(albumId = MOCK_ALBUM_ID) {
  return PHOTOS.filter((photo) => photo.albumId === albumId);
}
