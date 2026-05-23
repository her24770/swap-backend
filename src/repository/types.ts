import { Anuncio } from '@prisma/client';
/*
    Interfaz para búsqueda
*/
export interface PaginationOption {
    page?: number;
    limit?: number;
    sort?: 'fecha' | 'me_gusta' | 'precio';
    order?: 'asc' | 'desc';
    tipo?: string;
    estado?: string;
}


/*
    Interfaz para anuncios
*/

export interface BuscarAnuncios{
    limite?: number
    order?: "asc" | "desc"
    tipo? : string
}
