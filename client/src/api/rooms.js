import axios from '.';


/**
Retrieves all rooms from the server.
@returns {Promise<Array>} A promise that resolves to an array of room data.
*/
export const getAllRooms =async()=>{
    const {data} = await axios('/rooms')
    return data

}


export const getSingleRoom =async id=>{
    const {data} = await axios(`/room/${id}`)
    return data
}