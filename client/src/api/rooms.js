import axiosSecure from '.';


/**
Retrieves all rooms from the server.
@returns {Promise<Array>} A promise that resolves to an array of room data.
*/
export const getAllRooms =async()=>{
    const {data} = await axiosSecure('/rooms')
    return data

}



//Get single room from db
export const getSingleRoom =async id=>{
    const {data} = await axiosSecure(`/room/${id}`)
    return data
}

// Fetch all rooms for host
export const getHostRooms = async email => {
  const { data } = await axiosSecure(`/rooms/${email}`)
  return data
}



// Save a room data in db
export const addRoom = async roomData => {
  const { data } = await axiosSecure.post(`/rooms`, roomData)
  return data
}