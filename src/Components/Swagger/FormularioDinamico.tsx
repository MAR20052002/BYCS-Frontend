import React, { useEffect, useState } from "react";

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
            .catch((err) => console.error("Error cargando swagger:", err));
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
        if (!endpoint) return;

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

    // ✅ FIX tipos reales
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value, type } = e.target;

        let parsedValue: any = value;

        if (type === "number") {
            parsedValue = value === "" ? null : Number(value);
        }

        if (type === "checkbox") {
            parsedValue = (e.target as HTMLInputElement).checked;
        }

        setFormValues((prev) => ({
            ...prev,
            [name]: parsedValue,
        }));
    };

    const renderCampo = (key: string, property: Property) => {
        let type = "text";

        if (property.type === "integer" || property.type === "number") type = "number";
        if (property.format === "date-time") type = "datetime-local";
        if (property.format === "date") type = "date";
        if (property.format === "email") type = "email";

        // ✅ ENUM
        if (property.enum) {
            return (
                <div key={key} className="mb-2">
                    <label className="form-label">{key}</label>
                    <select
                        className="form-select"
                        name={key}
                        value={formValues[key] || ""}
                        onChange={handleChange}
                    >
                        <option value="">-- Selecciona --</option>
                        {property.enum.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>
            );
        }

        // ✅ BOOLEAN
        if (property.type === "boolean") {
            return (
                <div key={key} className="mb-2 form-check">
                    <input
                        type="checkbox"
                        className="form-check-input"
                        id={key}
                        name={key}
                        onChange={handleChange}
                    />
                    <label className="form-check-label" htmlFor={key}>
                        {key}
                    </label>
                </div>
            );
        }

        // ✅ ARRAY (simple)
        if (property.type === "array") {
            return (
                <div key={key} className="mb-2">
                    <label>{key} (separado por comas)</label>
                    <input
                        type="text"
                        className="form-control"
                        name={key}
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

        // ⚠️ OBJECT (fallback)
        if (property.type === "object") {
            return (
                <div key={key} className="border p-2 mb-2">
                    <strong>{key}</strong>
                    <div className="text-muted">Objeto no soportado aún</div>
                </div>
            );
        }

        return (
            <div key={key} className="mb-2">
                <label className="form-label">{key}</label>
                <input
                    type={type}
                    className="form-control"
                    name={key}
                    value={formValues[key] || ""}
                    onChange={handleChange}
                />
            </div>
        );
    };

    const renderBodyFields = () => {
        if (!schemaActual) return null;
        return Object.keys(schemaActual.properties).map((key) =>
            renderCampo(key, schemaActual.properties[key])
        );
    };

    const renderPathFields = () => {
        return parametrosPath.map((p) => renderCampo(p.name, p.schema));
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

                if (schemaActual) {
                    Object.keys(schemaActual.properties).forEach((key) => {
                        body[key] = formValues[key];
                    });
                }

                options.headers = { "Content-Type": "application/json" };
                options.body = JSON.stringify(body);
            }

            const res = await fetch(url, options);
            const text = await res.text();

            setRespuesta(text);
        } catch (err) {
            console.error("❌ Error:", err);
            setRespuesta("Error en la petición");
        }
    };

    if (!swagger) return <div>Cargando Swagger…</div>;

    return (
        <div className="container mt-3">
            <h1>Formulario Dinámico</h1>

            <div className="mb-3">
                <label className="form-label fw-bold">Selecciona un grupo (tag)</label>
                <select
                    className="form-select"
                    value={tagSeleccionado}
                    onChange={(e) => {
                        setTagSeleccionado(e.target.value);
                        setEndpointSeleccionado("");
                    }}
                >
                    <option value="">-- Selecciona un tag --</option>
                    {tags.map((t) => (
                        <option key={t} value={t}>
                            {t}
                        </option>
                    ))}
                </select>
            </div>

            {tagSeleccionado && (
                <div className="mb-3">
                    <label className="form-label fw-bold">Selecciona un endpoint</label>
                    <select
                        className="form-select"
                        value={endpointSeleccionado}
                        onChange={(e) => setEndpointSeleccionado(e.target.value)}
                    >
                        <option value="">-- Selecciona un endpoint --</option>
                        {endpointsPorTag[tagSeleccionado].map((ep) => (
                            <option key={ep} value={ep}>
                                {ep}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {endpointSeleccionado && (
                <div className="alert alert-secondary">
                    <strong>Método:</strong> {metodoReal.toUpperCase()}
                </div>
            )}

            {(parametrosPath.length > 0 || schemaActual) && (
                <div className="border p-3 mb-3">
                    {parametrosPath.length > 0 && (
                        <>
                            <h5>Parámetros del PATH</h5>
                            {renderPathFields()}
                        </>
                    )}

                    {schemaActual && (
                        <>
                            <h5 className="mt-3">Body JSON</h5>
                            {renderBodyFields()}
                        </>
                    )}
                </div>
            )}

            {endpointSeleccionado && (
                <button onClick={ejecutar} className="btn btn-primary mb-3">
                    Ejecutar {metodoReal.toUpperCase()}
                </button>
            )}

            {respuesta && (
                <div className="alert alert-info mt-4">
                    <h5>Respuesta del servidor:</h5>
                    <pre style={{
                        background: "#1e1e1e",
                        color: "#dcdcdc",
                        padding: "1rem",
                        borderRadius: "8px",
                        overflowX: "auto",
                        whiteSpace: "pre-wrap"
                    }}>
                        {formatearRespuesta(respuesta)}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default FormularioDinamico;