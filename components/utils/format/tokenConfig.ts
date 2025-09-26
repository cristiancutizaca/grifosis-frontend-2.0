export const tokenConfig = (value: string ) => {
  //console.log('token: ', value)
    return {
      headers: { Authorization: `Bearer ${value}` },
    };
  };
  export const URL = () => `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1`;
  export const getURL = () => `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1`;

export default tokenConfig;