import { Publicacion } from "@prisma/client";
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
    Resultados Paginados de Publicaciones
*/
export interface ResultadoBusquedaPublicacion {
    publicaciones: Publicacion[];
    total: number;
}

/*
    Interfaz para anuncios
*/

export interface BuscarAnuncios{
    limit?: number
    order?: "asc" | "desc"
}
