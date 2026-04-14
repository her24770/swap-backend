/*
    Interfaz para búsqueda
*/
export interface PaginationOption {
    page?: number;
    limit?: number;
    sort?: 'fecha' | 'me_gusta' | 'precio';
    order?: 'asc' | 'desc';
    tipo?: string;
}
