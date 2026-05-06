import { useEffect, useState } from "react";

const BASE_URL = "https://bycs-production.up.railway.app";

const formatearRespuesta = (raw: string) => {
    try {
        const json = JSON.parse(raw);
        return JSON.stringify(json, null, 2);
    } catch {
        return raw;
    }
};

// Interfaces
interface Property {
    type: string;
    format?: string;
    nullable?: boolean;
    enum?: string[];
    items?: Property;
}

interface Schema {
    type: string;
    properties: Record<string, Property>;
}

interface SwaggerData {
    paths: Record<string, any>;
    components: {
        schemas: Record<string, Schema>;
    };
}

const FormularioDinamico = () => {
    const [swagger, setSwagger] = useState<SwaggerData | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [tagSeleccionado, setTagSeleccionado] = useState<string>("");
    const [endpointsPorTag, setEndpointsPorTag] = useState<Record<string, string[]>>({});
    const [endpointSeleccionado, setEndpointSeleccionado] = useState<string>("");
    const [metodoReal, setMetodoReal] = useState<string>("");
    const [schemaActual, setSchemaActual] = useState<Schema | null>(null);
    const [parametrosPath, setParametrosPath] = useState<any[]>([]);
    const [respuesta, setRespuesta] = useState<any>(null);
    const [formValues, setFormValues] = useState<Record<string, any>>({});

    useEffect(() => {
        fetch("/swagger.json")
            .then((r) => r.json())
            .then((data) => {
                setSwagger(data);
                procesarTags(data);
            })
            .catch(console.error);
    }, []);

    const procesarTags = (data: SwaggerData) => {
        const mapa: Record<string, string[]> = {};

        Object.entries(data.paths).forEach(([path, methods]) => {
            const metodo = Object.keys(methods)[0];
            const info = methods[metodo];
            const tags = info.tags || ["SinTag"];

            tags.forEach((t: string) => {
                if (!mapa[t]) mapa[t] = [];
                mapa[t].push(path);
            });
        });

        setEndpointsPorTag(mapa);
        setTags(Object.keys(mapa));
    };

    useEffect(() => {
        if (!swagger || !endpointSeleccionado) return;

        const endpoint = swagger.paths[endpointSeleccionado];
        const metodo = Object.keys(endpoint)[0];

        setMetodoReal(metodo);

        const datosMetodo = endpoint[metodo];
        setParametrosPath(datosMetodo.parameters || []);

        const body = datosMetodo.requestBody?.content?.["application/json"]?.schema;

        if (body?.$ref) {
            const nombreSchema = body.$ref.replace("#/components/schemas/", "");
            setSchemaActual(swagger.components.schemas[nombreSchema]);
        } else {
            setSchemaActual(null);
        }

        setFormValues({});
    }, [swagger, endpointSeleccionado]);

    const handleChange = (e: any) => {
        const { name, value, type, checked } = e.target;

        let parsedValue: any = value;

        if (type === "number") parsedValue = value === "" ? null : Number(value);
        if (type === "checkbox") parsedValue = checked;

        setFormValues((prev) => ({
            ...prev,
            [name]: parsedValue,
        }));
    };

    const renderCampo = (key: string, property: Property) => {
        let type = "text";

        if (property.type === "integer" || property.type === "number") type = "number";
        if (property.format === "email") type = "email";

        // ⚠️ FECHAS → TEXTO
        if (property.format === "date" || property.format === "date-time") {
            type = "text";
        }

        if (property.enum) {
            return (
                <div key={key} className="mb-3">
                    <label className="form-label fw-semibold">{key}</label>
                    <select
                        className="form-select shadow-sm"
                        name={key}
                        value={formValues[key] || ""}
                        onChange={handleChange}
                    >
                        <option value="">Selecciona...</option>
                        {property.enum.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                </div>
            );
        }

        if (property.type === "boolean") {
            return (
                <div key={key} className="form-check mb-3">
                    <input
                        type="checkbox"
                        className="form-check-input"
                        name={key}
                        onChange={handleChange}
                    />
                    <label className="form-check-label">{key}</label>
                </div>
            );
        }

        if (property.type === "array") {
            return (
                <div key={key} className="mb-3">
                    <label className="form-label fw-semibold">{key}</label>
                    <input
                        type="text"
                        className="form-control shadow-sm"
                        placeholder="valor1, valor2..."
                        onChange={(e) =>
                            setFormValues((prev) => ({
                                ...prev,
                                [key]: e.target.value.split(",").map((v) => v.trim()),
                            }))
                        }
                    />
                </div>
            );
        }

        return (
            <div key={key} className="mb-3">
                <label className="form-label fw-semibold">{key}</label>
                <input
                    type={type}
                    className="form-control shadow-sm"
                    name={key}
                    value={formValues[key] || ""}
                    onChange={handleChange}
                />
            </div>
        );
    };

    const ejecutar = async () => {
        try {
            let url = BASE_URL + endpointSeleccionado;

            parametrosPath.forEach((p) => {
                url = url.replace(`{${p.name}}`, formValues[p.name]);
            });

            const method = metodoReal.toUpperCase();
            let options: RequestInit = { method };

            if (method === "POST" || method === "PUT") {
                const body: any = {};

                schemaActual &&
                    Object.keys(schemaActual.properties).forEach((key) => {
                        body[key] = formValues[key];
                    });

                options.headers = { "Content-Type": "application/json" };
                options.body = JSON.stringify(body);
            }

            const res = await fetch(url, options);
            const text = await res.text();
            setRespuesta(text);
        } catch {
            setRespuesta("Error en la petición");
        }
    };

    if (!swagger) return <div className="text-center mt-5">Cargando Swagger...</div>;

    return (
        <div className="container py-4" style={{ maxWidth: "900px" }}>
            <div className="card shadow-lg border-0">
                <div className="card-body">
                    <h2 className="mb-4 text-center fw-bold">🚀 API Tester Dinámico</h2>

                    {/* TAG */}
                    <div className="mb-4">
                        <label className="form-label fw-bold">Grupo</label>
                        <select
                            className="form-select shadow-sm"
                            value={tagSeleccionado}
                            onChange={(e) => {
                                setTagSeleccionado(e.target.value);
                                setEndpointSeleccionado("");
                            }}
                        >
                            <option value="">Selecciona un grupo...</option>
                            {tags.map((t) => (
                                <option key={t}>{t}</option>
                            ))}
                        </select>
                    </div>

                    {/* ENDPOINT */}
                    {tagSeleccionado && (
                        <div className="mb-4">
                            <label className="form-label fw-bold">Endpoint</label>
                            <select
                                className="form-select shadow-sm"
                                value={endpointSeleccionado}
                                onChange={(e) => setEndpointSeleccionado(e.target.value)}
                            >
                                <option value="">Selecciona...</option>
                                {endpointsPorTag[tagSeleccionado].map((ep) => (
                                    <option key={ep}>{ep}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* MÉTODO */}
                    {endpointSeleccionado && (
                        <div className="badge bg-dark mb-3">
                            {metodoReal.toUpperCase()}
                        </div>
                    )}

                    {/* FORM */}
                    {(parametrosPath.length > 0 || schemaActual) && (
                        <div className="p-3 bg-light rounded mb-3">
                            {parametrosPath.map((p) => renderCampo(p.name, p.schema))}
                            {schemaActual &&
                                Object.keys(schemaActual.properties).map((key) =>
                                    renderCampo(key, schemaActual.properties[key])
                                )}
                        </div>
                    )}

                    {/* BOTÓN */}
                    {endpointSeleccionado && (
                        <div className="d-grid">
                            <button
                                onClick={ejecutar}
                                className="btn btn-primary btn-lg shadow-sm"
                            >
                                Ejecutar {metodoReal.toUpperCase()}
                            </button>
                        </div>
                    )}

                    {/* RESPUESTA */}
                    {respuesta && (
                        <div className="mt-4">
                            <h5 className="fw-bold">Respuesta</h5>
                            <pre
                                style={{
                                    background: "#0d1117",
                                    color: "#c9d1d9",
                                    padding: "1rem",
                                    borderRadius: "10px",
                                    overflowX: "auto",
                                }}
                            >
                                {formatearRespuesta(respuesta)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FormularioDinamico;