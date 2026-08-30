export type DocumentType = 'aadhaar' | 'pan' | 'passport' | 'driving_licence';

export type DocumentMeta = {
  id: DocumentType;
  label: string;
  description: string;
  icon: string;
  accent: string;
};

export const DOCUMENT_TYPES: DocumentMeta[] = [
  {
    id: 'aadhaar',
    label: 'Aadhaar',
    description: '12-digit unique identity number',
    icon: 'Fingerprint',
    accent: 'from-rose-500 to-orange-500',
  },
  {
    id: 'pan',
    label: 'PAN Card',
    description: 'Permanent Account Number',
    icon: 'CreditCard',
    accent: 'from-sky-500 to-blue-600',
  },
  {
    id: 'passport',
    label: 'Passport',
    description: 'National travel document',
    icon: 'BookUser',
    accent: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'driving_licence',
    label: 'Driving Licence',
    description: 'Motor vehicle driving permit',
    icon: 'Car',
    accent: 'from-violet-500 to-purple-600',
  },
];
