export interface Inmate {
  id: string;
  name: string;
  rg: string;
  crime: string;
  riskLevel: 'Baixo' | 'Médio' | 'Alto' | 'Extremo';
  photoUri?: string;
  cell: string;
  embeddings?: number[]; // Mock vector
}

export const MOCK_INMATES: Inmate[] = [
  {
    id: '1',
    name: 'CARLOS SILVA DE SOUSA',
    rg: '12.345.678-9',
    crime: 'Art. 157',
    riskLevel: 'Médio',
    cell: 'BLOCO A - CELA 12',
    photoUri: 'https://randomuser.me/api/portraits/men/1.jpg',
  },
  {
    id: '2',
    name: 'MARCOS RODRIGUES',
    rg: '98.765.432-1',
    crime: 'Art. 33',
    riskLevel: 'Alto',
    cell: 'BLOCO B - CELA 05',
    photoUri: 'https://randomuser.me/api/portraits/men/2.jpg',
  },
  {
    id: '3',
    name: 'JOÃO PEREIRA NETO',
    rg: '11.222.333-4',
    crime: 'Art. 121',
    riskLevel: 'Extremo',
    cell: 'ISO 01',
    photoUri: 'https://randomuser.me/api/portraits/men/3.jpg',
  },
];
