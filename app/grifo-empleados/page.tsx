'use client'

import Layout from '../../src/components/Layout'
import EmpleadosContent from './empleados-content'

const GrifoEmpleados = () => {
    return (
        <Layout currentPage="reportes">
            <EmpleadosContent />
        </Layout>
    )
}

export default GrifoEmpleados
