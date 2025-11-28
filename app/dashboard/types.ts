export interface ArmazemOption {
  value: string;
  label: string;
  morada?: string;
  codigo_pos?: string;
}

export interface TransportadoraOption {
  value: string;
  label: string;
}

export interface Holiday {
  id: string;
  holiday_date: string;
  description: string;
}

export interface ClienteOption {
  value: string;
  label: string;
}
