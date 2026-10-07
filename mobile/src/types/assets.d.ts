/** Metro treats .glb as an asset (metro.config.js); a require() gives the asset module id. */
declare module "*.glb" {
  const moduleId: number;
  export default moduleId;
}

declare module "*.jpg" {
  const moduleId: number;
  export default moduleId;
}
