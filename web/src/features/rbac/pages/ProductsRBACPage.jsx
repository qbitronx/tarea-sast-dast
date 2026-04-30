import ProductsRBACTab from '../components/ProductsRBACTab';

export default function ProductsRBACPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Products (RBAC)</h1>
        <div className="alert alert-info" style={{ margin: 0, fontSize: 12 }}>
          Acceso controlado por rol — sin filtros de departamento ni de propiedad
        </div>
      </div>
      <ProductsRBACTab />
    </div>
  );
}
