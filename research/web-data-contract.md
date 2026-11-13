# Static extraction explorer contract
Parent agent generates public/data/catalog.json and other public/data files; design agent must not write them. No backend/API needed. Fetch using import.meta.env.BASE_URL + 'data/catalog.json'.

Catalog:
```
{
 title: string, description: string, folderUrl: string,
 inventory: [{id,name,path,mimeType,size?,webViewLink,format,status}],
 layers: [{id,name,source,sourceUrl,format,count,geometryType,crs,units,fields:[{name,type}],extent:[],recordsUrl,geometryUrl?,notes:[],sample:object[]}],
 documents: [{name,sourceUrl,pageCount,pages:[{page:number,text:string,imageUrl?:string}],notes:[]}],
 rasters: [{name,source,sourceUrl,metadata:object,notes:string[]}],
 metadata: [{name,sourceUrl,text:string}],
 issues: [{severity,source,locator,message}],
 methods: string[],
 summary: {fileCount:number,folderCount:number,totalBytes:number,layerCount:number,recordCount:number,pdfPages:number}
}
```
recordsUrl points to JSON array: [{_source:{filename,layer,featureId}, ...originalFieldValues}]. Fetch lazily for searchable paginated table and JSON download. geometryUrl links to lossless WKB records in JSONL/gzip if available, not for maps. File paths in URLs are relative to BASE_URL. Documents include every PDF text page, citations need source filename + page (physical 1-based). Layers retain distinct source versions and include filename/layer citation in detail; do NOT sum records as unique entities across overlapping datasets. Expose full CRS WKT and units. Raster metadata is JSON; do not infer elevation from hillshade. Issues are first-class. Every visible scientific result must have source and locator. Inventory includes complete recursive folder tree; search by path/format. No fake content. Handle missing/empty loading/error state. All exports are real file links/JSON blob downloads. Build presentation from catalog, no hardcoded scientific claims. Can compute totals from catalog, not fictional charts.
