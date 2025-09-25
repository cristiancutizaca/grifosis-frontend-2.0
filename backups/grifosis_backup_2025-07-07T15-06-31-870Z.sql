--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: can_create_user_role(character varying, character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.can_create_user_role(creator_role character varying, target_role character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Superadmin puede crear cualquier rol
    IF creator_role = 'superadmin' THEN
        RETURN TRUE;
    END IF;
    
    -- Admin puede crear admin y seller, pero no superadmin
    IF creator_role = 'admin' THEN
        RETURN target_role IN ('admin', 'seller');
    END IF;
    
    -- Seller no puede crear usuarios
    IF creator_role = 'seller' THEN
        RETURN FALSE;
    END IF;
    
    RETURN FALSE;
END;
$$;


ALTER FUNCTION public.can_create_user_role(creator_role character varying, target_role character varying) OWNER TO postgres;

--
-- Name: can_manage_user(character varying, integer, character varying, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.can_manage_user(manager_role character varying, manager_id integer, target_role character varying, target_id integer) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Un usuario no puede gestionarse a sí mismo para cambios de rol
    IF manager_id = target_id THEN
        RETURN FALSE;
    END IF;
    
    -- Superadmin puede gestionar cualquier usuario
    IF manager_role = 'superadmin' THEN
        RETURN TRUE;
    END IF;
    
    -- Admin puede gestionar admin y seller, pero no superadmin
    IF manager_role = 'admin' THEN
        RETURN target_role IN ('admin', 'seller');
    END IF;
    
    -- Seller no puede gestionar usuarios
    RETURN FALSE;
END;
$$;


ALTER FUNCTION public.can_manage_user(manager_role character varying, manager_id integer, target_role character varying, target_id integer) OWNER TO postgres;

--
-- Name: get_default_permissions(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_default_permissions(user_role character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
BEGIN
    CASE user_role
        WHEN 'superadmin' THEN
            RETURN '{
                "modules": [
                    {"module": "users", "actions": ["create", "read", "update", "delete"]},
                    {"module": "clients", "actions": ["create", "read", "update", "delete"]},
                    {"module": "sales", "actions": ["create", "read", "update", "delete", "cancel"]},
                    {"module": "payments", "actions": ["create", "read", "update", "delete"]},
                    {"module": "products", "actions": ["create", "read", "update", "delete"]},
                    {"module": "reports", "actions": ["read", "export"]},
                    {"module": "settings", "actions": ["read", "update", "backup", "restore"]},
                    {"module": "credits", "actions": ["create", "read", "update", "delete"]},
                    {"module": "expenses", "actions": ["create", "read", "update", "delete"]},
                    {"module": "suppliers", "actions": ["create", "read", "update", "delete"]},
                    {"module": "employees", "actions": ["create", "read", "update", "delete"]},
                    {"module": "tanks", "actions": ["create", "read", "update", "delete"]},
                    {"module": "pumps", "actions": ["create", "read", "update", "delete"]},
                    {"module": "nozzles", "actions": ["create", "read", "update", "delete"]}
                ],
                "isAdmin": true
            }'::JSONB;
        WHEN 'admin' THEN
            RETURN '{
                "modules": [
                    {"module": "users", "actions": ["create", "read", "update"]},
                    {"module": "clients", "actions": ["create", "read", "update"]},
                    {"module": "sales", "actions": ["create", "read", "update"]},
                    {"module": "payments", "actions": ["create", "read", "update"]},
                    {"module": "products", "actions": ["create", "read", "update"]},
                    {"module": "reports", "actions": ["read", "export"]},
                    {"module": "credits", "actions": ["create", "read", "update"]},
                    {"module": "expenses", "actions": ["create", "read", "update"]},
                    {"module": "employees", "actions": ["create", "read", "update"]},
                    {"module": "suppliers", "actions": ["create", "read", "update"]},
                    {"module": "tanks", "actions": ["read", "update"]},
                    {"module": "pumps", "actions": ["read", "update"]},
                    {"module": "nozzles", "actions": ["read", "update"]}
                ],
                "isAdmin": false
            }'::JSONB;
        WHEN 'seller' THEN
            RETURN '{
                "modules": [
                    {"module": "clients", "actions": ["read", "update"]},
                    {"module": "sales", "actions": ["create", "read"]},
                    {"module": "payments", "actions": ["create", "read"]},
                    {"module": "products", "actions": ["read"]},
                    {"module": "reports", "actions": ["read"]},
                    {"module": "credits", "actions": ["read"]}
                ],
                "isAdmin": false
            }'::JSONB;
        ELSE
            RETURN '{
                "modules": [],
                "isAdmin": false
            }'::JSONB;
    END CASE;
END;
$$;


ALTER FUNCTION public.get_default_permissions(user_role character varying) OWNER TO postgres;

--
-- Name: log_user_audit(character varying, integer, integer, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_user_audit(p_action character varying, p_performed_by integer, p_target_user integer, p_details jsonb DEFAULT NULL::jsonb, p_previous_data jsonb DEFAULT NULL::jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO public.user_audit_logs (
        action,
        performed_by,
        target_user,
        details,
        previous_data
    ) VALUES (
        p_action,
        p_performed_by,
        p_target_user,
        p_details,
        p_previous_data
    );
END;
$$;


ALTER FUNCTION public.log_user_audit(p_action character varying, p_performed_by integer, p_target_user integer, p_details jsonb, p_previous_data jsonb) OWNER TO postgres;

--
-- Name: validate_role_hierarchy(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_role_hierarchy() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Validar que superadmin puede no tener employee_id
    IF NEW.role = 'superadmin' AND NEW.employee_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Validar que otros roles requieren employee_id
    IF NEW.role != 'superadmin' AND NEW.employee_id IS NULL THEN
        RAISE EXCEPTION 'Los usuarios con rol % deben tener un employee_id asociado', NEW.role;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_role_hierarchy() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cash_registers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cash_registers (
    id integer NOT NULL,
    shift_id integer,
    opened_by integer,
    closed_by integer,
    opening_amount numeric(10,2) NOT NULL,
    closing_amount numeric(10,2),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.cash_registers OWNER TO postgres;

--
-- Name: cash_registers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cash_registers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cash_registers_id_seq OWNER TO postgres;

--
-- Name: cash_registers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cash_registers_id_seq OWNED BY public.cash_registers.id;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    client_id integer NOT NULL,
    client_type character varying(10) NOT NULL,
    category character varying(20) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    company_name character varying(255),
    document_type character varying(20),
    document_number character varying(20),
    address text,
    phone character varying(50),
    email character varying(255),
    birth_date date,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone,
    CONSTRAINT clients_category_check CHECK (((category)::text = ANY ((ARRAY['credito'::character varying, 'contado'::character varying, 'frecuente'::character varying, 'moroso'::character varying])::text[]))),
    CONSTRAINT clients_client_type_check CHECK (((client_type)::text = ANY ((ARRAY['persona'::character varying, 'empresa'::character varying])::text[])))
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- Name: clients_client_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clients_client_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clients_client_id_seq OWNER TO postgres;

--
-- Name: clients_client_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clients_client_id_seq OWNED BY public.clients.client_id;


--
-- Name: credits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.credits (
    credit_id integer NOT NULL,
    client_id integer NOT NULL,
    sale_id integer NOT NULL,
    credit_amount numeric(10,2) NOT NULL,
    amount_paid numeric(10,2) DEFAULT 0 NOT NULL,
    due_date date NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone,
    CONSTRAINT credits_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'overdue'::character varying])::text[])))
);


ALTER TABLE public.credits OWNER TO postgres;

--
-- Name: credits_credit_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.credits_credit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.credits_credit_id_seq OWNER TO postgres;

--
-- Name: credits_credit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.credits_credit_id_seq OWNED BY public.credits.credit_id;


--
-- Name: deliveries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deliveries (
    delivery_id integer NOT NULL,
    supplier_id integer NOT NULL,
    delivery_timestamp timestamp without time zone DEFAULT now() NOT NULL,
    invoice_number character varying(100),
    notes text,
    user_id integer NOT NULL
);


ALTER TABLE public.deliveries OWNER TO postgres;

--
-- Name: deliveries_delivery_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.deliveries_delivery_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.deliveries_delivery_id_seq OWNER TO postgres;

--
-- Name: deliveries_delivery_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.deliveries_delivery_id_seq OWNED BY public.deliveries.delivery_id;


--
-- Name: delivery_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.delivery_details (
    delivery_detail_id integer NOT NULL,
    delivery_id integer NOT NULL,
    product_id integer NOT NULL,
    tank_id integer NOT NULL,
    quantity_delivered numeric(10,3) NOT NULL,
    unit_cost numeric(10,2)
);


ALTER TABLE public.delivery_details OWNER TO postgres;

--
-- Name: delivery_details_delivery_detail_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.delivery_details_delivery_detail_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.delivery_details_delivery_detail_id_seq OWNER TO postgres;

--
-- Name: delivery_details_delivery_detail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.delivery_details_delivery_detail_id_seq OWNED BY public.delivery_details.delivery_detail_id;


--
-- Name: discounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.discounts (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    percentage numeric(5,2) NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.discounts OWNER TO postgres;

--
-- Name: discounts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.discounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.discounts_id_seq OWNER TO postgres;

--
-- Name: discounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.discounts_id_seq OWNED BY public.discounts.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    employee_id integer NOT NULL,
    dni character(8) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    "position" character varying(100) NOT NULL,
    birth_date date,
    address text,
    phone_number character varying(50),
    email character varying(255),
    hire_date date NOT NULL,
    termination_date date,
    is_active boolean DEFAULT true NOT NULL,
    file_path text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- Name: employees_employee_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employees_employee_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employees_employee_id_seq OWNER TO postgres;

--
-- Name: employees_employee_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employees_employee_id_seq OWNED BY public.employees.employee_id;


--
-- Name: expense_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expense_categories (
    category_id integer NOT NULL,
    category_name character varying(100) NOT NULL
);


ALTER TABLE public.expense_categories OWNER TO postgres;

--
-- Name: expense_categories_category_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.expense_categories_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.expense_categories_category_id_seq OWNER TO postgres;

--
-- Name: expense_categories_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.expense_categories_category_id_seq OWNED BY public.expense_categories.category_id;


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expenses (
    expense_id integer NOT NULL,
    user_id integer NOT NULL,
    expense_timestamp timestamp without time zone DEFAULT now() NOT NULL,
    category_id integer NOT NULL,
    description text NOT NULL,
    amount numeric(10,2) NOT NULL,
    payment_method_id integer NOT NULL,
    receipt_path text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);


ALTER TABLE public.expenses OWNER TO postgres;

--
-- Name: expenses_expense_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.expenses_expense_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.expenses_expense_id_seq OWNER TO postgres;

--
-- Name: expenses_expense_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.expenses_expense_id_seq OWNED BY public.expenses.expense_id;


--
-- Name: meter_readings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.meter_readings (
    reading_id integer NOT NULL,
    nozzle_id integer NOT NULL,
    user_id integer NOT NULL,
    reading_timestamp timestamp without time zone DEFAULT now() NOT NULL,
    meter_value numeric(15,3) NOT NULL,
    notes text,
    reading_type character varying(20) DEFAULT 'regular'::character varying NOT NULL,
    CONSTRAINT meter_readings_reading_type_check CHECK (((reading_type)::text = ANY ((ARRAY['regular'::character varying, 'opening'::character varying, 'closing'::character varying, 'verification'::character varying])::text[])))
);


ALTER TABLE public.meter_readings OWNER TO postgres;

--
-- Name: meter_readings_reading_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.meter_readings_reading_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.meter_readings_reading_id_seq OWNER TO postgres;

--
-- Name: meter_readings_reading_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.meter_readings_reading_id_seq OWNED BY public.meter_readings.reading_id;


--
-- Name: nozzles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nozzles (
    nozzle_id integer NOT NULL,
    pump_id integer NOT NULL,
    product_id integer NOT NULL,
    tank_id integer NOT NULL,
    nozzle_number integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);


ALTER TABLE public.nozzles OWNER TO postgres;

--
-- Name: nozzles_nozzle_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nozzles_nozzle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.nozzles_nozzle_id_seq OWNER TO postgres;

--
-- Name: nozzles_nozzle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nozzles_nozzle_id_seq OWNED BY public.nozzles.nozzle_id;


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_methods (
    payment_method_id integer NOT NULL,
    method_name character varying(50) NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.payment_methods OWNER TO postgres;

--
-- Name: payment_methods_payment_method_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_methods_payment_method_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_methods_payment_method_id_seq OWNER TO postgres;

--
-- Name: payment_methods_payment_method_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_methods_payment_method_id_seq OWNED BY public.payment_methods.payment_method_id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    payment_id integer NOT NULL,
    user_id integer NOT NULL,
    sale_id integer,
    credit_id integer,
    payment_timestamp timestamp without time zone DEFAULT now() NOT NULL,
    amount numeric(10,2) NOT NULL,
    payment_method_id integer NOT NULL,
    notes text,
    CONSTRAINT payments_check CHECK ((((sale_id IS NOT NULL) AND (credit_id IS NULL)) OR ((sale_id IS NULL) AND (credit_id IS NOT NULL))))
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: payments_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payments_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payments_payment_id_seq OWNER TO postgres;

--
-- Name: payments_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payments_payment_id_seq OWNED BY public.payments.payment_id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    product_id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(20) NOT NULL,
    fuel_type character varying(20),
    unit character varying(10) DEFAULT 'Galón'::character varying NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone,
    CONSTRAINT products_category_check CHECK (((category)::text = ANY ((ARRAY['combustible'::character varying, 'aditivo'::character varying, 'accesorio'::character varying, 'otro'::character varying])::text[]))),
    CONSTRAINT products_fuel_type_check CHECK (((fuel_type)::text = ANY ((ARRAY['diesel'::character varying, 'premium'::character varying, 'regular'::character varying])::text[])))
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: products_product_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_product_id_seq OWNER TO postgres;

--
-- Name: products_product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_product_id_seq OWNED BY public.products.product_id;


--
-- Name: pumps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pumps (
    pump_id integer NOT NULL,
    pump_number character varying(50) NOT NULL,
    pump_name character varying(100) NOT NULL,
    location_description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);


ALTER TABLE public.pumps OWNER TO postgres;

--
-- Name: pumps_pump_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pumps_pump_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pumps_pump_id_seq OWNER TO postgres;

--
-- Name: pumps_pump_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pumps_pump_id_seq OWNED BY public.pumps.pump_id;


--
-- Name: sale_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sale_details (
    sale_detail_id integer NOT NULL,
    sale_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity numeric(10,3) NOT NULL,
    unit_price_at_sale numeric(10,2) NOT NULL,
    discount_amount numeric(10,2) DEFAULT 0 NOT NULL,
    tax_rate numeric(4,2) DEFAULT 0.18 NOT NULL,
    tax_amount numeric(10,2) NOT NULL,
    subtotal numeric(10,2) NOT NULL
);


ALTER TABLE public.sale_details OWNER TO postgres;

--
-- Name: sale_details_sale_detail_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sale_details_sale_detail_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sale_details_sale_detail_id_seq OWNER TO postgres;

--
-- Name: sale_details_sale_detail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sale_details_sale_detail_id_seq OWNED BY public.sale_details.sale_detail_id;


--
-- Name: sales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales (
    sale_id integer NOT NULL,
    client_id integer,
    user_id integer NOT NULL,
    employee_id integer,
    nozzle_id integer NOT NULL,
    sale_timestamp timestamp without time zone DEFAULT now() NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    payment_method_id integer NOT NULL,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    shift character varying(50),
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_status_check CHECK (((status)::text = ANY ((ARRAY['completed'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.sales OWNER TO postgres;

--
-- Name: sales_sale_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sales_sale_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sales_sale_id_seq OWNER TO postgres;

--
-- Name: sales_sale_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sales_sale_id_seq OWNED BY public.sales.sale_id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.settings (
    setting_id integer NOT NULL,
    name character varying(255) NOT NULL,
    ruc character varying(11) NOT NULL,
    address text,
    phone character varying(50),
    company_name character varying(255),
    email character varying(255),
    web_address character varying(255),
    social_networks jsonb,
    logo text,
    currency character varying(10),
    invoices jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone
);


ALTER TABLE public.settings OWNER TO postgres;

--
-- Name: shifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shifts (
    id integer NOT NULL,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    opened_by integer,
    closed_by integer,
    initial_amount numeric(10,2) NOT NULL,
    final_amount numeric(10,2),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.shifts OWNER TO postgres;

--
-- Name: shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shifts_id_seq OWNER TO postgres;

--
-- Name: shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shifts_id_seq OWNED BY public.shifts.id;


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_movements (
    stock_movement_id integer NOT NULL,
    product_id integer NOT NULL,
    tank_id integer NOT NULL,
    user_id integer NOT NULL,
    movement_timestamp timestamp without time zone DEFAULT now() NOT NULL,
    movement_type character varying(20) NOT NULL,
    quantity numeric(10,3) NOT NULL,
    sale_detail_id integer,
    delivery_detail_id integer,
    description text,
    CONSTRAINT stock_movements_movement_type_check CHECK (((movement_type)::text = ANY ((ARRAY['entrada'::character varying, 'salida'::character varying, 'ajuste'::character varying])::text[])))
);


ALTER TABLE public.stock_movements OWNER TO postgres;

--
-- Name: stock_movements_stock_movement_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_movements_stock_movement_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_movements_stock_movement_id_seq OWNER TO postgres;

--
-- Name: stock_movements_stock_movement_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_movements_stock_movement_id_seq OWNED BY public.stock_movements.stock_movement_id;


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suppliers (
    supplier_id integer NOT NULL,
    supplier_name character varying(255) NOT NULL,
    ruc character varying(11),
    address text,
    phone character varying(50),
    email character varying(255),
    contact_person character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);


ALTER TABLE public.suppliers OWNER TO postgres;

--
-- Name: suppliers_supplier_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.suppliers_supplier_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.suppliers_supplier_id_seq OWNER TO postgres;

--
-- Name: suppliers_supplier_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.suppliers_supplier_id_seq OWNED BY public.suppliers.supplier_id;


--
-- Name: tanks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tanks (
    tank_id integer NOT NULL,
    tank_name character varying(100) NOT NULL,
    product_id integer NOT NULL,
    total_capacity numeric(10,3) NOT NULL,
    location character varying(255),
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);


ALTER TABLE public.tanks OWNER TO postgres;

--
-- Name: tanks_tank_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tanks_tank_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tanks_tank_id_seq OWNER TO postgres;

--
-- Name: tanks_tank_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tanks_tank_id_seq OWNED BY public.tanks.tank_id;


--
-- Name: user_audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_audit_logs (
    audit_id integer NOT NULL,
    action character varying(20) NOT NULL,
    performed_by integer NOT NULL,
    target_user integer NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
    details jsonb,
    previous_data jsonb,
    CONSTRAINT user_audit_logs_action_check CHECK (((action)::text = ANY ((ARRAY['create'::character varying, 'update'::character varying, 'delete'::character varying, 'activate'::character varying, 'deactivate'::character varying])::text[])))
);


ALTER TABLE public.user_audit_logs OWNER TO postgres;

--
-- Name: TABLE user_audit_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_audit_logs IS 'Registro de auditoría para operaciones de gestión de usuarios';


--
-- Name: user_audit_logs_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_audit_logs_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_audit_logs_audit_id_seq OWNER TO postgres;

--
-- Name: user_audit_logs_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_audit_logs_audit_id_seq OWNED BY public.user_audit_logs.audit_id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    employee_id integer,
    username character varying(50) NOT NULL,
    password_hash text NOT NULL,
    role character varying(20) NOT NULL,
    permissions jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone,
    full_name character varying(255),
    CONSTRAINT users_check CHECK ((((role)::text = 'superadmin'::text) OR (employee_id IS NOT NULL))),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['superadmin'::character varying, 'admin'::character varying, 'seller'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.users IS 'Tabla de usuarios del sistema con roles jerárquicos';


--
-- Name: COLUMN users.role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.role IS 'Rol del usuario: superadmin (nivel 3), admin (nivel 2), seller (nivel 1)';


--
-- Name: COLUMN users.permissions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.permissions IS 'Permisos específicos del usuario en formato JSON';


--
-- Name: users_safe_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.users_safe_view AS
 SELECT user_id,
    employee_id,
    username,
    role,
    permissions,
    is_active,
    full_name,
    created_at,
    updated_at
   FROM public.users;


ALTER VIEW public.users_safe_view OWNER TO postgres;

--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_user_id_seq OWNER TO postgres;

--
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- Name: cash_registers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_registers ALTER COLUMN id SET DEFAULT nextval('public.cash_registers_id_seq'::regclass);


--
-- Name: clients client_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients ALTER COLUMN client_id SET DEFAULT nextval('public.clients_client_id_seq'::regclass);


--
-- Name: credits credit_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credits ALTER COLUMN credit_id SET DEFAULT nextval('public.credits_credit_id_seq'::regclass);


--
-- Name: deliveries delivery_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliveries ALTER COLUMN delivery_id SET DEFAULT nextval('public.deliveries_delivery_id_seq'::regclass);


--
-- Name: delivery_details delivery_detail_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_details ALTER COLUMN delivery_detail_id SET DEFAULT nextval('public.delivery_details_delivery_detail_id_seq'::regclass);


--
-- Name: discounts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discounts ALTER COLUMN id SET DEFAULT nextval('public.discounts_id_seq'::regclass);


--
-- Name: employees employee_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees ALTER COLUMN employee_id SET DEFAULT nextval('public.employees_employee_id_seq'::regclass);


--
-- Name: expense_categories category_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_categories ALTER COLUMN category_id SET DEFAULT nextval('public.expense_categories_category_id_seq'::regclass);


--
-- Name: expenses expense_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses ALTER COLUMN expense_id SET DEFAULT nextval('public.expenses_expense_id_seq'::regclass);


--
-- Name: meter_readings reading_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meter_readings ALTER COLUMN reading_id SET DEFAULT nextval('public.meter_readings_reading_id_seq'::regclass);


--
-- Name: nozzles nozzle_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nozzles ALTER COLUMN nozzle_id SET DEFAULT nextval('public.nozzles_nozzle_id_seq'::regclass);


--
-- Name: payment_methods payment_method_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods ALTER COLUMN payment_method_id SET DEFAULT nextval('public.payment_methods_payment_method_id_seq'::regclass);


--
-- Name: payments payment_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments ALTER COLUMN payment_id SET DEFAULT nextval('public.payments_payment_id_seq'::regclass);


--
-- Name: products product_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN product_id SET DEFAULT nextval('public.products_product_id_seq'::regclass);


--
-- Name: pumps pump_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pumps ALTER COLUMN pump_id SET DEFAULT nextval('public.pumps_pump_id_seq'::regclass);


--
-- Name: sale_details sale_detail_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_details ALTER COLUMN sale_detail_id SET DEFAULT nextval('public.sale_details_sale_detail_id_seq'::regclass);


--
-- Name: sales sale_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales ALTER COLUMN sale_id SET DEFAULT nextval('public.sales_sale_id_seq'::regclass);


--
-- Name: shifts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts ALTER COLUMN id SET DEFAULT nextval('public.shifts_id_seq'::regclass);


--
-- Name: stock_movements stock_movement_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements ALTER COLUMN stock_movement_id SET DEFAULT nextval('public.stock_movements_stock_movement_id_seq'::regclass);


--
-- Name: suppliers supplier_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN supplier_id SET DEFAULT nextval('public.suppliers_supplier_id_seq'::regclass);


--
-- Name: tanks tank_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tanks ALTER COLUMN tank_id SET DEFAULT nextval('public.tanks_tank_id_seq'::regclass);


--
-- Name: user_audit_logs audit_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_audit_logs ALTER COLUMN audit_id SET DEFAULT nextval('public.user_audit_logs_audit_id_seq'::regclass);


--
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- Data for Name: cash_registers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cash_registers (id, shift_id, opened_by, closed_by, opening_amount, closing_amount, created_at) FROM stdin;
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clients (client_id, client_type, category, first_name, last_name, company_name, document_type, document_number, address, phone, email, birth_date, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: credits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.credits (credit_id, client_id, sale_id, credit_amount, amount_paid, due_date, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: deliveries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deliveries (delivery_id, supplier_id, delivery_timestamp, invoice_number, notes, user_id) FROM stdin;
\.


--
-- Data for Name: delivery_details; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.delivery_details (delivery_detail_id, delivery_id, product_id, tank_id, quantity_delivered, unit_cost) FROM stdin;
\.


--
-- Data for Name: discounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.discounts (id, name, percentage, active, created_at) FROM stdin;
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employees (employee_id, dni, first_name, last_name, "position", birth_date, address, phone_number, email, hire_date, termination_date, is_active, file_path, created_at, updated_at) FROM stdin;
1	12345678	Admin	Demo	Administrador	1990-01-01	Dirección ficticia 123	999999999	admin.demo@grifo.com	2025-07-03	\N	t	\N	2025-07-03 16:44:35.5676	2025-07-03 16:44:35.5676
2	87654321	Vendedor	Demo	Vendedor	1995-05-10	Av. Comercio 456	988888888	vendedor.demo@grifo.com	2025-07-03	\N	t	\N	2025-07-03 16:45:50.655529	2025-07-03 16:45:50.655529
3	11223344	Admin	Correcto	Administrador	1991-03-15	Av. Prueba 321	911223344	admin.correcto@grifo.com	2025-07-03	\N	t	\N	2025-07-03 16:49:39.527024	2025-07-03 16:49:39.527024
\.


--
-- Data for Name: expense_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.expense_categories (category_id, category_name) FROM stdin;
\.


--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.expenses (expense_id, user_id, expense_timestamp, category_id, description, amount, payment_method_id, receipt_path, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: meter_readings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.meter_readings (reading_id, nozzle_id, user_id, reading_timestamp, meter_value, notes, reading_type) FROM stdin;
\.


--
-- Data for Name: nozzles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nozzles (nozzle_id, pump_id, product_id, tank_id, nozzle_number, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payment_methods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_methods (payment_method_id, method_name, is_active) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (payment_id, user_id, sale_id, credit_id, payment_timestamp, amount, payment_method_id, notes) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (product_id, name, description, category, fuel_type, unit, unit_price, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: pumps; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pumps (pump_id, pump_number, pump_name, location_description, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sale_details; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sale_details (sale_detail_id, sale_id, product_id, quantity, unit_price_at_sale, discount_amount, tax_rate, tax_amount, subtotal) FROM stdin;
\.


--
-- Data for Name: sales; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales (sale_id, client_id, user_id, employee_id, nozzle_id, sale_timestamp, total_amount, payment_method_id, status, shift, notes, created_at) FROM stdin;
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.settings (setting_id, name, ruc, address, phone, company_name, email, web_address, social_networks, logo, currency, invoices, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: shifts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shifts (id, start_time, end_time, opened_by, closed_by, initial_amount, final_amount, created_at) FROM stdin;
1	2025-06-05 03:00:00	\N	1	\N	1000.00	\N	2025-06-06 11:45:18.168941
\.


--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_movements (stock_movement_id, product_id, tank_id, user_id, movement_timestamp, movement_type, quantity, sale_detail_id, delivery_detail_id, description) FROM stdin;
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suppliers (supplier_id, supplier_name, ruc, address, phone, email, contact_person, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: tanks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tanks (tank_id, tank_name, product_id, total_capacity, location, description, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_audit_logs (audit_id, action, performed_by, target_user, "timestamp", details, previous_data) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, employee_id, username, password_hash, role, permissions, is_active, created_at, updated_at, full_name) FROM stdin;
7	\N	superadmin_user	$2b$10$wnGswtEUXOWo7m3s9OqI/ej42ardGXfoJDKFCxtR.I3FD0fvqAzLu	superadmin	{"isAdmin": true, "modules": [{"module": "users", "actions": ["create", "read", "update", "delete"]}, {"module": "clients", "actions": ["create", "read", "update", "delete"]}, {"module": "sales", "actions": ["create", "read", "update", "delete", "cancel"]}, {"module": "payments", "actions": ["create", "read", "update", "delete"]}, {"module": "products", "actions": ["create", "read", "update", "delete"]}, {"module": "reports", "actions": ["read", "export"]}, {"module": "settings", "actions": ["read", "update", "backup", "restore"]}, {"module": "credits", "actions": ["create", "read", "update", "delete"]}, {"module": "expenses", "actions": ["create", "read", "update", "delete"]}, {"module": "suppliers", "actions": ["create", "read", "update", "delete"]}, {"module": "employees", "actions": ["create", "read", "update", "delete"]}, {"module": "tanks", "actions": ["create", "read", "update", "delete"]}, {"module": "pumps", "actions": ["create", "read", "update", "delete"]}, {"module": "nozzles", "actions": ["create", "read", "update", "delete"]}]}	t	2025-06-26 11:32:03.263933	\N	\N
10	\N	superadmin_user_2	$2b$10$UvOOyQWNqNdhJJG2D2S8E.j5ZQF8dlBU6j1VBYCGo54dqYcnDyU5a	superadmin	{"isAdmin": true, "modules": [{"module": "users", "actions": ["create", "read", "update", "delete"]}, {"module": "clients", "actions": ["create", "read", "update", "delete"]}, {"module": "sales", "actions": ["create", "read", "update", "delete", "cancel"]}, {"module": "payments", "actions": ["create", "read", "update", "delete"]}, {"module": "products", "actions": ["create", "read", "update", "delete"]}, {"module": "reports", "actions": ["read", "export"]}, {"module": "settings", "actions": ["read", "update", "backup", "restore"]}, {"module": "credits", "actions": ["create", "read", "update", "delete"]}, {"module": "expenses", "actions": ["create", "read", "update", "delete"]}, {"module": "suppliers", "actions": ["create", "read", "update", "delete"]}, {"module": "employees", "actions": ["create", "read", "update", "delete"]}, {"module": "tanks", "actions": ["create", "read", "update", "delete"]}, {"module": "pumps", "actions": ["create", "read", "update", "delete"]}, {"module": "nozzles", "actions": ["create", "read", "update", "delete"]}]}	t	2025-06-26 11:34:31.087142	\N	\N
6	\N	grifo_user	$2b$10$cux9/MuBsoiEEMxCkOVokeHIMDaLlOxQhIxiDuyYKjsK6WvtdxcqS	superadmin	{"isAdmin": true, "modules": [{"module": "users", "actions": ["create", "read", "update", "delete"]}, {"module": "clients", "actions": ["create", "read", "update", "delete"]}, {"module": "sales", "actions": ["create", "read", "update", "delete", "cancel"]}, {"module": "payments", "actions": ["create", "read", "update", "delete"]}, {"module": "products", "actions": ["create", "read", "update", "delete"]}, {"module": "reports", "actions": ["read", "export"]}, {"module": "settings", "actions": ["read", "update", "backup", "restore"]}, {"module": "credits", "actions": ["create", "read", "update", "delete"]}, {"module": "expenses", "actions": ["create", "read", "update", "delete"]}, {"module": "suppliers", "actions": ["create", "read", "update", "delete"]}, {"module": "employees", "actions": ["create", "read", "update", "delete"]}, {"module": "tanks", "actions": ["create", "read", "update", "delete"]}, {"module": "pumps", "actions": ["create", "read", "update", "delete"]}, {"module": "nozzles", "actions": ["create", "read", "update", "delete"]}]}	t	2025-06-24 16:04:56.409964	\N	Vendedor 1
1	\N	admin	$2b$10$2dIUfX1Xt./PrkZ8S2fvceN1k1ok7A8c.Zq9mvFhyCzujEYzxyHZm	superadmin	{"isAdmin": true, "modules": [{"module": "users", "actions": ["create", "read", "update", "delete"]}, {"module": "clients", "actions": ["create", "read", "update", "delete"]}, {"module": "sales", "actions": ["create", "read", "update", "delete", "cancel"]}, {"module": "payments", "actions": ["create", "read", "update", "delete"]}, {"module": "products", "actions": ["create", "read", "update", "delete"]}, {"module": "reports", "actions": ["read", "export"]}, {"module": "settings", "actions": ["read", "update", "backup", "restore"]}, {"module": "credits", "actions": ["create", "read", "update", "delete"]}, {"module": "expenses", "actions": ["create", "read", "update", "delete"]}, {"module": "suppliers", "actions": ["create", "read", "update", "delete"]}, {"module": "employees", "actions": ["create", "read", "update", "delete"]}, {"module": "tanks", "actions": ["create", "read", "update", "delete"]}, {"module": "pumps", "actions": ["create", "read", "update", "delete"]}, {"module": "nozzles", "actions": ["create", "read", "update", "delete"]}]}	t	2025-06-04 09:40:06.271924	\N	Administrador Principal
12	\N	nuevo_usuario	$2b$10$uxhmfw2ZM1xMbHUuwv67e.9N2D4ERY1m5DSi211H3d3wDmsJ7mz0S	superadmin	{"isAdmin": true, "modules": [{"module": "users", "actions": ["create", "read", "update", "delete"]}, {"module": "clients", "actions": ["create", "read", "update", "delete"]}, {"module": "sales", "actions": ["create", "read", "update", "delete", "cancel"]}, {"module": "payments", "actions": ["create", "read", "update", "delete"]}, {"module": "products", "actions": ["create", "read", "update", "delete"]}, {"module": "reports", "actions": ["read", "export"]}, {"module": "settings", "actions": ["read", "update", "backup", "restore"]}, {"module": "credits", "actions": ["create", "read", "update", "delete"]}, {"module": "expenses", "actions": ["create", "read", "update", "delete"]}, {"module": "suppliers", "actions": ["create", "read", "update", "delete"]}, {"module": "employees", "actions": ["create", "read", "update", "delete"]}, {"module": "tanks", "actions": ["create", "read", "update", "delete"]}, {"module": "pumps", "actions": ["create", "read", "update", "delete"]}, {"module": "nozzles", "actions": ["create", "read", "update", "delete"]}]}	t	2025-07-02 10:31:29.911148	2025-07-02 10:31:29.911148	Nombre de prueba
13	\N	adminsuyo	$2b$10$c1SIK2dIF0j/0TAQBN.P1.qLL/cuoTH44lAhEYvXM2y8H9.PZRUkW	superadmin	{"isAdmin": true, "modules": [{"module": "users", "actions": ["create", "read", "update", "delete"]}, {"module": "clients", "actions": ["create", "read", "update", "delete"]}, {"module": "sales", "actions": ["create", "read", "update", "delete", "cancel"]}, {"module": "payments", "actions": ["create", "read", "update", "delete"]}, {"module": "products", "actions": ["create", "read", "update", "delete"]}, {"module": "reports", "actions": ["read", "export"]}, {"module": "settings", "actions": ["read", "update", "backup", "restore"]}, {"module": "credits", "actions": ["create", "read", "update", "delete"]}, {"module": "expenses", "actions": ["create", "read", "update", "delete"]}, {"module": "suppliers", "actions": ["create", "read", "update", "delete"]}, {"module": "employees", "actions": ["create", "read", "update", "delete"]}, {"module": "tanks", "actions": ["create", "read", "update", "delete"]}, {"module": "pumps", "actions": ["create", "read", "update", "delete"]}, {"module": "nozzles", "actions": ["create", "read", "update", "delete"]}]}	t	2025-07-02 14:28:03.784122	2025-07-02 14:28:03.784122	Nombre de prueba
15	\N	superadmin_test	$2b$10$wnGswtEUXOWo7m3s9OqI/ej42ardGXfoJDKFCxtR.I3FD0fvqAzLu	superadmin	{"isAdmin": true, "modules": [{"module": "users", "actions": ["create", "read", "update", "delete"]}, {"module": "clients", "actions": ["create", "read", "update", "delete"]}, {"module": "sales", "actions": ["create", "read", "update", "delete", "cancel"]}, {"module": "payments", "actions": ["create", "read", "update", "delete"]}, {"module": "products", "actions": ["create", "read", "update", "delete"]}, {"module": "reports", "actions": ["read", "export"]}, {"module": "settings", "actions": ["read", "update", "backup", "restore"]}, {"module": "credits", "actions": ["create", "read", "update", "delete"]}, {"module": "expenses", "actions": ["create", "read", "update", "delete"]}, {"module": "suppliers", "actions": ["create", "read", "update", "delete"]}, {"module": "employees", "actions": ["create", "read", "update", "delete"]}, {"module": "tanks", "actions": ["create", "read", "update", "delete"]}, {"module": "pumps", "actions": ["create", "read", "update", "delete"]}, {"module": "nozzles", "actions": ["create", "read", "update", "delete"]}]}	t	2025-07-03 15:02:38.661582	\N	Superadministrador de Prueba
18	2	vendedor_demo	$2b$10$8oClvBFnAOK6W/642ajTMeMnKhAoV6HkcwQkYqKJolG2QQs3nWDnm	seller	[]	t	2025-07-03 16:48:03.577901	2025-07-03 16:48:03.577901	Vendedor de Prueba
20	3	admin_demo	$2b$10$8oClvBFnAOK6W/642ajTMeMnKhAoV6HkcwQkYqKJolG2QQs3nWDnm	admin	[]	t	2025-07-03 16:54:18.485621	2025-07-03 16:54:18.485621	Admin de Prueba
\.


--
-- Name: cash_registers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cash_registers_id_seq', 1, false);


--
-- Name: clients_client_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.clients_client_id_seq', 1, false);


--
-- Name: credits_credit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.credits_credit_id_seq', 1, false);


--
-- Name: deliveries_delivery_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.deliveries_delivery_id_seq', 1, false);


--
-- Name: delivery_details_delivery_detail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.delivery_details_delivery_detail_id_seq', 1, false);


--
-- Name: discounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.discounts_id_seq', 1, false);


--
-- Name: employees_employee_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.employees_employee_id_seq', 3, true);


--
-- Name: expense_categories_category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.expense_categories_category_id_seq', 1, false);


--
-- Name: expenses_expense_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.expenses_expense_id_seq', 1, false);


--
-- Name: meter_readings_reading_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.meter_readings_reading_id_seq', 1, false);


--
-- Name: nozzles_nozzle_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nozzles_nozzle_id_seq', 1, false);


--
-- Name: payment_methods_payment_method_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_methods_payment_method_id_seq', 1, false);


--
-- Name: payments_payment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payments_payment_id_seq', 1, false);


--
-- Name: products_product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_product_id_seq', 1, false);


--
-- Name: pumps_pump_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pumps_pump_id_seq', 1, false);


--
-- Name: sale_details_sale_detail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sale_details_sale_detail_id_seq', 1, false);


--
-- Name: sales_sale_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sales_sale_id_seq', 1, false);


--
-- Name: shifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shifts_id_seq', 1, true);


--
-- Name: stock_movements_stock_movement_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_movements_stock_movement_id_seq', 1, false);


--
-- Name: suppliers_supplier_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.suppliers_supplier_id_seq', 1, false);


--
-- Name: tanks_tank_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tanks_tank_id_seq', 1, false);


--
-- Name: user_audit_logs_audit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_audit_logs_audit_id_seq', 1, false);


--
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_id_seq', 20, true);


--
-- Name: cash_registers cash_registers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT cash_registers_pkey PRIMARY KEY (id);


--
-- Name: clients clients_document_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_document_number_key UNIQUE (document_number);


--
-- Name: clients clients_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_email_key UNIQUE (email);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (client_id);


--
-- Name: credits credits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT credits_pkey PRIMARY KEY (credit_id);


--
-- Name: credits credits_sale_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT credits_sale_id_key UNIQUE (sale_id);


--
-- Name: deliveries deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_pkey PRIMARY KEY (delivery_id);


--
-- Name: delivery_details delivery_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_details
    ADD CONSTRAINT delivery_details_pkey PRIMARY KEY (delivery_detail_id);


--
-- Name: discounts discounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discounts
    ADD CONSTRAINT discounts_pkey PRIMARY KEY (id);


--
-- Name: employees employees_dni_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_dni_key UNIQUE (dni);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (employee_id);


--
-- Name: expense_categories expense_categories_category_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_category_name_key UNIQUE (category_name);


--
-- Name: expense_categories expense_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (category_id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (expense_id);


--
-- Name: meter_readings meter_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meter_readings
    ADD CONSTRAINT meter_readings_pkey PRIMARY KEY (reading_id);


--
-- Name: nozzles nozzles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nozzles
    ADD CONSTRAINT nozzles_pkey PRIMARY KEY (nozzle_id);


--
-- Name: payment_methods payment_methods_method_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_method_name_key UNIQUE (method_name);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (payment_method_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (payment_id);


--
-- Name: products products_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_name_key UNIQUE (name);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (product_id);


--
-- Name: pumps pumps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pumps
    ADD CONSTRAINT pumps_pkey PRIMARY KEY (pump_id);


--
-- Name: pumps pumps_pump_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pumps
    ADD CONSTRAINT pumps_pump_name_key UNIQUE (pump_name);


--
-- Name: pumps pumps_pump_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pumps
    ADD CONSTRAINT pumps_pump_number_key UNIQUE (pump_number);


--
-- Name: sale_details sale_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_details
    ADD CONSTRAINT sale_details_pkey PRIMARY KEY (sale_detail_id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (sale_id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (setting_id);


--
-- Name: settings settings_ruc_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_ruc_key UNIQUE (ruc);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (stock_movement_id);


--
-- Name: suppliers suppliers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_email_key UNIQUE (email);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (supplier_id);


--
-- Name: suppliers suppliers_ruc_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_ruc_key UNIQUE (ruc);


--
-- Name: tanks tanks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tanks
    ADD CONSTRAINT tanks_pkey PRIMARY KEY (tank_id);


--
-- Name: tanks tanks_tank_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tanks
    ADD CONSTRAINT tanks_tank_name_key UNIQUE (tank_name);


--
-- Name: user_audit_logs user_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_audit_logs
    ADD CONSTRAINT user_audit_logs_pkey PRIMARY KEY (audit_id);


--
-- Name: users users_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_id_key UNIQUE (employee_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_user_audit_logs_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_audit_logs_action ON public.user_audit_logs USING btree (action);


--
-- Name: idx_user_audit_logs_performed_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_audit_logs_performed_by ON public.user_audit_logs USING btree (performed_by);


--
-- Name: idx_user_audit_logs_target_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_audit_logs_target_user ON public.user_audit_logs USING btree (target_user);


--
-- Name: idx_user_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_audit_logs_timestamp ON public.user_audit_logs USING btree ("timestamp");


--
-- Name: idx_users_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_role_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role_active ON public.users USING btree (role, is_active);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: users trigger_validate_role_hierarchy; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_validate_role_hierarchy BEFORE INSERT OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.validate_role_hierarchy();


--
-- Name: cash_registers cash_registers_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT cash_registers_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(user_id);


--
-- Name: cash_registers cash_registers_opened_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT cash_registers_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES public.users(user_id);


--
-- Name: cash_registers cash_registers_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT cash_registers_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: credits credits_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT credits_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id);


--
-- Name: credits credits_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT credits_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(sale_id);


--
-- Name: deliveries deliveries_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(supplier_id);


--
-- Name: deliveries deliveries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: delivery_details delivery_details_delivery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_details
    ADD CONSTRAINT delivery_details_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(delivery_id);


--
-- Name: delivery_details delivery_details_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_details
    ADD CONSTRAINT delivery_details_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- Name: delivery_details delivery_details_tank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_details
    ADD CONSTRAINT delivery_details_tank_id_fkey FOREIGN KEY (tank_id) REFERENCES public.tanks(tank_id);


--
-- Name: expenses expenses_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.expense_categories(category_id);


--
-- Name: expenses expenses_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(payment_method_id);


--
-- Name: expenses expenses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: meter_readings meter_readings_nozzle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meter_readings
    ADD CONSTRAINT meter_readings_nozzle_id_fkey FOREIGN KEY (nozzle_id) REFERENCES public.nozzles(nozzle_id);


--
-- Name: meter_readings meter_readings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meter_readings
    ADD CONSTRAINT meter_readings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: nozzles nozzles_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nozzles
    ADD CONSTRAINT nozzles_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- Name: nozzles nozzles_pump_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nozzles
    ADD CONSTRAINT nozzles_pump_id_fkey FOREIGN KEY (pump_id) REFERENCES public.pumps(pump_id);


--
-- Name: nozzles nozzles_tank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nozzles
    ADD CONSTRAINT nozzles_tank_id_fkey FOREIGN KEY (tank_id) REFERENCES public.tanks(tank_id);


--
-- Name: payments payments_credit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_credit_id_fkey FOREIGN KEY (credit_id) REFERENCES public.credits(credit_id);


--
-- Name: payments payments_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(payment_method_id);


--
-- Name: payments payments_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(sale_id);


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: sale_details sale_details_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_details
    ADD CONSTRAINT sale_details_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- Name: sale_details sale_details_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_details
    ADD CONSTRAINT sale_details_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(sale_id);


--
-- Name: sales sales_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id);


--
-- Name: sales sales_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id);


--
-- Name: sales sales_nozzle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_nozzle_id_fkey FOREIGN KEY (nozzle_id) REFERENCES public.nozzles(nozzle_id);


--
-- Name: sales sales_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(payment_method_id);


--
-- Name: sales sales_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: shifts shifts_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(user_id);


--
-- Name: shifts shifts_opened_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES public.users(user_id);


--
-- Name: stock_movements stock_movements_delivery_detail_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_delivery_detail_id_fkey FOREIGN KEY (delivery_detail_id) REFERENCES public.delivery_details(delivery_detail_id);


--
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- Name: stock_movements stock_movements_sale_detail_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_sale_detail_id_fkey FOREIGN KEY (sale_detail_id) REFERENCES public.sale_details(sale_detail_id);


--
-- Name: stock_movements stock_movements_tank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_tank_id_fkey FOREIGN KEY (tank_id) REFERENCES public.tanks(tank_id);


--
-- Name: stock_movements stock_movements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: tanks tanks_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tanks
    ADD CONSTRAINT tanks_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- Name: user_audit_logs user_audit_logs_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_audit_logs
    ADD CONSTRAINT user_audit_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(user_id);


--
-- Name: user_audit_logs user_audit_logs_target_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_audit_logs
    ADD CONSTRAINT user_audit_logs_target_user_fkey FOREIGN KEY (target_user) REFERENCES public.users(user_id);


--
-- Name: users users_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id);


--
-- PostgreSQL database dump complete
--

